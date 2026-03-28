import type { Attributes } from "@opentelemetry/api";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";

export const SpanKind = {
  SPAN: "span",
  AGENT: "agent",
  TOOL: "tool",
  LLM: "llm"
} as const;

export type SpanKind = (typeof SpanKind)[keyof typeof SpanKind];

export const Integration = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
  LANGCHAIN: "langchain"
} as const;

export type Integration = (typeof Integration)[keyof typeof Integration];

export type AnyFunction = (...args: any[]) => any;

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface UsageInput extends Usage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

export interface InitializeOptions {
  apiKey?: string;
  api_key?: string;
  hostUrl?: string;
  host_url?: string;
  flushInterval?: number;
  flush_interval?: number;
  batchSize?: number;
  batch_size?: number;
  flushAt?: number;
  flush_at?: number;
  timeout?: number;
  enabled?: boolean;
  integrations?: Integration[];
  gitRepo?: string;
  git_repo?: string;
  gitRef?: string;
  git_ref?: string;
  serviceName?: string;
  service_name?: string;
  environment?: string;
  exporter?: SpanExporter;
}

export interface ObserveOptions {
  name?: string;
  type?: SpanKind | string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  captureInput?: boolean;
  capture_input?: boolean;
  captureOutput?: boolean;
  capture_output?: boolean;
}

export interface UsingAttributesOptions {
  userId?: string;
  user_id?: string;
  sessionId?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  attributes?: Attributes;
}

export interface UpdateCurrentSpanOptions {
  name?: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  model?: string;
  modelParameters?: Record<string, unknown>;
  model_parameters?: Record<string, unknown>;
  usage?: UsageInput;
  prompt?: unknown;
}

export interface UpdateCurrentTraceOptions {
  userId?: string;
  user_id?: string;
  sessionId?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface SourceLocation {
  gitSourceFile?: string;
  gitSourceLine?: number;
  gitSourceFunction?: string;
}
