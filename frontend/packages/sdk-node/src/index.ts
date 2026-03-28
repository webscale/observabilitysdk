import { trace } from "@opentelemetry/api";

import { TracerootClient } from "./client";
import { usingAttributes } from "./context";
import { observe } from "./decorators";
import { getGlobalClient, initializeGlobalClient, shutdownGlobalClient } from "./global-client";
import { updateCurrentSpan, updateCurrentTrace } from "./update";
import { Integration, SpanKind } from "./types";

export type {
  InitializeOptions,
  Integration as IntegrationValue,
  ObserveOptions,
  SpanKind as SpanKindValue,
  UpdateCurrentSpanOptions,
  UpdateCurrentTraceOptions,
  UsingAttributesOptions,
  Usage,
  UsageInput
} from "./types";

export {
  Integration,
  SpanKind,
  TracerootClient,
  observe,
  updateCurrentSpan,
  updateCurrentTrace,
  usingAttributes
};

export function initialize(options = {}): TracerootClient {
  return initializeGlobalClient(options);
}

export function getClient(): TracerootClient {
  return getGlobalClient();
}

export async function flush(): Promise<void> {
  await getGlobalClient().flush();
}

export async function shutdown(): Promise<void> {
  await shutdownGlobalClient();
}

export function getCurrentTraceId(): string | null {
  const span = trace.getActiveSpan();
  return span ? span.spanContext().traceId : null;
}

export function getCurrentSpanId(): string | null {
  const span = trace.getActiveSpan();
  return span ? span.spanContext().spanId : null;
}

export const using_attributes = usingAttributes;
export const update_current_span = updateCurrentSpan;
export const update_current_trace = updateCurrentTrace;
export const get_current_trace_id = getCurrentTraceId;
export const get_current_span_id = getCurrentSpanId;
