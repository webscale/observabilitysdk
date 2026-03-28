import { SpanStatusCode, trace } from "@opentelemetry/api";

import { SpanAttributes } from "./constants";
import { serializeValue, setSpanAttribute } from "./serialize";
import type { UpdateCurrentSpanOptions, UpdateCurrentTraceOptions, UsageInput } from "./types";

function normalizeUsage(usage?: UsageInput): UsageInput | undefined {
  if (!usage) {
    return undefined;
  }

  const inputTokens = usage.inputTokens ?? usage.input_tokens;
  const outputTokens = usage.outputTokens ?? usage.output_tokens;
  const totalTokens =
    usage.totalTokens ?? usage.total_tokens ?? (inputTokens ?? 0) + (outputTokens ?? 0);

  return {
    inputTokens,
    outputTokens,
    totalTokens
  };
}

export function updateCurrentSpan(options: UpdateCurrentSpanOptions = {}): void {
  const span = trace.getActiveSpan();
  if (!span || !span.isRecording()) {
    return;
  }

  if (options.name) {
    span.updateName(options.name);
  }

  setSpanAttribute(span, SpanAttributes.SPAN_INPUT, options.input);
  setSpanAttribute(span, SpanAttributes.SPAN_OUTPUT, options.output);
  setSpanAttribute(span, SpanAttributes.SPAN_METADATA, options.metadata);

  if (options.model) {
    span.setAttribute(SpanAttributes.LLM_MODEL, options.model);
    span.setAttribute(SpanAttributes.OI_LLM_MODEL_NAME, options.model);
    span.setAttribute(SpanAttributes.GENAI_MODEL, options.model);
  }

  const modelParameters = options.modelParameters ?? options.model_parameters;
  setSpanAttribute(span, SpanAttributes.LLM_MODEL_PARAMETERS, modelParameters);

  const usage = normalizeUsage(options.usage);
  if (usage) {
    setSpanAttribute(span, SpanAttributes.LLM_USAGE, usage);

    if (usage.inputTokens != null) {
      span.setAttribute(SpanAttributes.OI_LLM_PROMPT_TOKENS, usage.inputTokens);
      span.setAttribute(SpanAttributes.GENAI_INPUT_TOKENS, usage.inputTokens);
    }

    if (usage.outputTokens != null) {
      span.setAttribute(SpanAttributes.OI_LLM_COMPLETION_TOKENS, usage.outputTokens);
      span.setAttribute(SpanAttributes.GENAI_OUTPUT_TOKENS, usage.outputTokens);
    }

    if (usage.totalTokens != null) {
      span.setAttribute(SpanAttributes.OI_LLM_TOTAL_TOKENS, usage.totalTokens);
      span.setAttribute(SpanAttributes.GENAI_TOTAL_TOKENS, usage.totalTokens);
    }
  }

  if (options.prompt !== undefined) {
    setSpanAttribute(span, SpanAttributes.LLM_PROMPT, options.prompt);
    setSpanAttribute(span, SpanAttributes.OI_LLM_INPUT_MESSAGES, serializeValue(options.prompt));
  }
}

export function updateCurrentTrace(options: UpdateCurrentTraceOptions = {}): void {
  const span = trace.getActiveSpan();
  if (!span || !span.isRecording()) {
    return;
  }

  const userId = options.userId ?? options.user_id;
  const sessionId = options.sessionId ?? options.session_id;

  if (userId) {
    span.setAttribute(SpanAttributes.TRACE_USER_ID, userId);
    span.setAttribute(SpanAttributes.OPENINFERENCE_USER_ID, userId);
  }

  if (sessionId) {
    span.setAttribute(SpanAttributes.TRACE_SESSION_ID, sessionId);
    span.setAttribute(SpanAttributes.OPENINFERENCE_SESSION_ID, sessionId);
  }

  setSpanAttribute(span, SpanAttributes.TRACE_METADATA, options.metadata);

  if (options.tags) {
    span.setAttribute(SpanAttributes.TRACE_TAGS, options.tags);
  }
}

export function markCurrentSpanError(error: unknown): void {
  const span = trace.getActiveSpan();
  if (!span || !span.isRecording()) {
    return;
  }

  span.recordException(error instanceof Error ? error : new Error(String(error)));
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error instanceof Error ? error.message : String(error)
  });
}
