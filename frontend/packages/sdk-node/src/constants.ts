export const TRACEROOT_TRACER_NAME = "traceroot-sdk";
export const SDK_NAME = "traceroot-node";
export const SDK_VERSION = "0.0.1";

export const DEFAULT_HOST_URL = "https://app.traceroot.ai";
export const DEFAULT_FLUSH_AT = 100;
export const DEFAULT_FLUSH_INTERVAL = 5.0;
export const DEFAULT_TIMEOUT = 30.0;
export const DEFAULT_SERVICE_NAME = "unknown_service";
export const DEFAULT_ENVIRONMENT = "default";

export const ENV_VARS = {
  API_KEY: "TRACEROOT_API_KEY",
  HOST_URL: "TRACEROOT_HOST_URL",
  ENABLED: "TRACEROOT_ENABLED",
  FLUSH_INTERVAL: "TRACEROOT_FLUSH_INTERVAL",
  FLUSH_AT: "TRACEROOT_FLUSH_AT",
  TIMEOUT: "TRACEROOT_TIMEOUT",
  GIT_REPO: "TRACEROOT_GIT_REPO",
  GIT_REF: "TRACEROOT_GIT_REF",
  SERVICE_NAME: "TRACEROOT_SERVICE_NAME",
  ENVIRONMENT: "TRACEROOT_ENVIRONMENT"
} as const;

export const SpanAttributes = {
  SPAN_TYPE: "traceroot.span.type",
  SPAN_INPUT: "traceroot.span.input",
  SPAN_OUTPUT: "traceroot.span.output",
  SPAN_METADATA: "traceroot.span.metadata",
  SPAN_TAGS: "traceroot.span.tags",
  TRACE_USER_ID: "traceroot.trace.user_id",
  TRACE_SESSION_ID: "traceroot.trace.session_id",
  TRACE_METADATA: "traceroot.trace.metadata",
  TRACE_TAGS: "traceroot.trace.tags",
  LLM_MODEL: "traceroot.llm.model",
  LLM_MODEL_PARAMETERS: "traceroot.llm.model_parameters",
  LLM_USAGE: "traceroot.llm.usage",
  LLM_PROMPT: "traceroot.llm.prompt",
  GIT_REPO: "traceroot.git.repo",
  GIT_REF: "traceroot.git.ref",
  GIT_SOURCE_FILE: "traceroot.git.source_file",
  GIT_SOURCE_LINE: "traceroot.git.source_line",
  GIT_SOURCE_FUNCTION: "traceroot.git.source_function",
  OPENINFERENCE_SPAN_KIND: "openinference.span.kind",
  OPENINFERENCE_USER_ID: "user.id",
  OPENINFERENCE_SESSION_ID: "session.id",
  OI_LLM_MODEL_NAME: "llm.model_name",
  OI_LLM_INPUT_MESSAGES: "llm.input_messages",
  OI_LLM_PROMPT_TOKENS: "llm.token_count.prompt",
  OI_LLM_COMPLETION_TOKENS: "llm.token_count.completion",
  OI_LLM_TOTAL_TOKENS: "llm.token_count.total",
  GENAI_MODEL: "gen_ai.request.model",
  GENAI_INPUT_TOKENS: "gen_ai.usage.input_tokens",
  GENAI_OUTPUT_TOKENS: "gen_ai.usage.output_tokens",
  GENAI_TOTAL_TOKENS: "gen_ai.usage.total_tokens"
} as const;
