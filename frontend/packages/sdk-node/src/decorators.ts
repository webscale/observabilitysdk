import type { Span } from "@opentelemetry/api";
import { SpanStatusCode, trace } from "@opentelemetry/api";

import { SDK_VERSION, SpanAttributes, TRACEROOT_TRACER_NAME } from "./constants";
import { getCurrentContextAttributes } from "./context";
import { captureSourceLocation } from "./git-context";
import { getGlobalClient } from "./global-client";
import { isPromiseLike, setSpanAttribute } from "./serialize";
import type { AnyFunction, ObserveOptions, SourceLocation, SpanKind } from "./types";

type NormalizedObserveOptions = {
  name?: string;
  type: SpanKind;
  metadata?: Record<string, unknown>;
  tags?: string[];
  captureInput: boolean;
  captureOutput: boolean;
};

function normalizeKind(kind?: string): SpanKind {
  const lowered = kind?.toLowerCase();
  if (lowered === "agent" || lowered === "tool" || lowered === "llm" || lowered === "span") {
    return lowered;
  }

  return "span";
}

function normalizeObserveOptions(options: ObserveOptions = {}): NormalizedObserveOptions {
  return {
    name: options.name,
    type: normalizeKind(options.type),
    metadata: options.metadata,
    tags: options.tags,
    captureInput: options.captureInput ?? options.capture_input ?? true,
    captureOutput: options.captureOutput ?? options.capture_output ?? true
  };
}

function getOpenInferenceSpanKind(kind: SpanKind): string {
  if (kind === "llm") {
    return "LLM";
  }

  if (kind === "agent") {
    return "AGENT";
  }

  if (kind === "tool") {
    return "TOOL";
  }

  return "CHAIN";
}

function getFunctionParameterNames(fn: AnyFunction): string[] {
  const source = fn
    .toString()
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const match =
    source.match(/^[^(]*\(([^)]*)\)/) ??
    source.match(/^(?:async\s*)?([A-Za-z_$][\w$]*)\s*=>/);

  const params = match?.[1] ?? "";
  if (!params.trim()) {
    return [];
  }

  return params
    .split(",")
    .map((param) =>
      param
        .trim()
        .replace(/^\.{3}/, "")
        .replace(/\s*=.+$/, "")
        .replace(/[:?].+$/, ""),
    )
    .filter((param) => param !== "" && param !== "this");
}

function captureArgs(fn: AnyFunction, args: unknown[]): Record<string, unknown> {
  const parameterNames = getFunctionParameterNames(fn);

  if (parameterNames.length === 0) {
    return Object.fromEntries(args.map((value, index) => [`arg${index}`, value]));
  }

  return Object.fromEntries(
    args.map((value, index) => [parameterNames[index] ?? `arg${index}`, value]),
  );
}

function applySpanSetup(
  span: Span,
  fn: AnyFunction,
  args: unknown[],
  options: NormalizedObserveOptions,
  sourceLocation: SourceLocation,
): void {
  span.setAttribute(SpanAttributes.SPAN_TYPE, options.type);
  span.setAttribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, getOpenInferenceSpanKind(options.type));

  const contextAttributes = getCurrentContextAttributes();
  if (Object.keys(contextAttributes).length > 0) {
    span.setAttributes(contextAttributes);
  }

  if (options.captureInput) {
    setSpanAttribute(span, SpanAttributes.SPAN_INPUT, captureArgs(fn, args));
  }

  if (options.metadata) {
    setSpanAttribute(span, SpanAttributes.SPAN_METADATA, options.metadata);
  }

  if (options.tags) {
    span.setAttribute(SpanAttributes.SPAN_TAGS, options.tags);
  }

  if (sourceLocation.gitSourceFile) {
    span.setAttribute(SpanAttributes.GIT_SOURCE_FILE, sourceLocation.gitSourceFile);
  }

  if (sourceLocation.gitSourceLine != null) {
    span.setAttribute(SpanAttributes.GIT_SOURCE_LINE, sourceLocation.gitSourceLine);
  }

  if (sourceLocation.gitSourceFunction) {
    span.setAttribute(SpanAttributes.GIT_SOURCE_FUNCTION, sourceLocation.gitSourceFunction);
  }

  const client = getGlobalClient();
  if (client.gitRepo) {
    span.setAttribute(SpanAttributes.GIT_REPO, client.gitRepo);
  }

  if (client.gitRef) {
    span.setAttribute(SpanAttributes.GIT_REF, client.gitRef);
  }
}

function wrapObservedFunction<Fn extends AnyFunction>(
  fn: Fn,
  options: ObserveOptions = {},
  sourceLocation: SourceLocation = captureSourceLocation(fn.name || undefined),
): Fn {
  const normalized = normalizeObserveOptions(options);
  const spanName = normalized.name ?? fn.name ?? "anonymous";

  const wrapped = function (this: unknown, ...args: Parameters<Fn>): ReturnType<Fn> {
    getGlobalClient();
    const tracer = trace.getTracer(TRACEROOT_TRACER_NAME, SDK_VERSION);

    const result = tracer.startActiveSpan(spanName, (span: Span) => {
      applySpanSetup(span, fn, args, normalized, {
        ...sourceLocation,
        gitSourceFunction: sourceLocation.gitSourceFunction ?? fn.name ?? spanName
      });

      try {
        const result = fn.apply(this, args) as ReturnType<Fn>;

        if (isPromiseLike(result)) {
          return result
            .then((resolved: Awaited<ReturnType<Fn>>) => {
              if (normalized.captureOutput && resolved !== undefined) {
                setSpanAttribute(span, SpanAttributes.SPAN_OUTPUT, resolved);
              }

              span.setStatus({ code: SpanStatusCode.OK });
              return resolved;
            })
            .catch((error: unknown) => {
              span.recordException(error instanceof Error ? error : new Error(String(error)));
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : String(error)
              });
              throw error;
            })
            .finally(() => {
              span.end();
            }) as ReturnType<Fn>;
        }

        if (normalized.captureOutput && result !== undefined) {
          setSpanAttribute(span, SpanAttributes.SPAN_OUTPUT, result);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (error) {
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error)
        });
        span.end();
        throw error;
      }
    });

    return result as ReturnType<Fn>;
  };

  Object.defineProperty(wrapped, "name", {
    configurable: true,
    value: fn.name
  });

  return wrapped as Fn;
}

function isStage3MethodDecoratorContext(value: unknown): value is { name: string | symbol } {
  return typeof value === "object" && value !== null && "name" in value;
}

type ObserveDecorator = (...args: any[]) => any;

export function observe<Fn extends AnyFunction>(fn: Fn, options?: ObserveOptions): Fn;
export function observe(options?: ObserveOptions): ObserveDecorator;
export function observe<Fn extends AnyFunction>(
  fnOrOptions?: Fn | ObserveOptions,
  maybeOptions?: ObserveOptions,
): Fn | ObserveDecorator {
  if (typeof fnOrOptions === "function") {
    return wrapObservedFunction(fnOrOptions as Fn, maybeOptions);
  }

  const options = fnOrOptions;

  return function (
    targetOrFn: unknown,
    contextOrPropertyKey: { name: string | symbol } | string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    if (typeof targetOrFn === "function" && isStage3MethodDecoratorContext(contextOrPropertyKey)) {
      return wrapObservedFunction(
        targetOrFn as AnyFunction,
        options,
        captureSourceLocation(String(contextOrPropertyKey.name)),
      );
    }

    if (descriptor?.value && typeof descriptor.value === "function") {
      descriptor.value = wrapObservedFunction(
        descriptor.value,
        options,
        captureSourceLocation(String(contextOrPropertyKey)),
      );
      return descriptor;
    }

    throw new TypeError("observe() can wrap a function directly or be used as a method decorator.");
  };
}
