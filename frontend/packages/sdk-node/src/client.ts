import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { Resource } from "@opentelemetry/resources";
import { BatchSpanProcessor, type SpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_FLUSH_AT,
  DEFAULT_FLUSH_INTERVAL,
  DEFAULT_HOST_URL,
  DEFAULT_SERVICE_NAME,
  DEFAULT_TIMEOUT,
  ENV_VARS,
  SDK_NAME,
  SDK_VERSION
} from "./constants";
import { autoDetectGitContext } from "./git-context";
import { initializeIntegrations } from "./instrumentation";
import type { InitializeOptions, Integration } from "./types";

function getEnvBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  return !["false", "0", "no", "off"].includes(value.toLowerCase());
}

function getCurrentMutableProvider(): NodeTracerProvider | null {
  const provider = trace.getTracerProvider() as NodeTracerProvider & {
    getDelegate?: () => unknown;
    addSpanProcessor?: (processor: BatchSpanProcessor) => void;
  };

  const providerType = provider?.constructor?.name;

  if (!provider || providerType === "NoopTracerProvider") {
    return null;
  }

  if (providerType === "ProxyTracerProvider" && typeof provider.getDelegate === "function") {
    const delegate = provider.getDelegate() as NodeTracerProvider & {
      addSpanProcessor?: (processor: BatchSpanProcessor) => void;
    };
    if (delegate && typeof delegate.addSpanProcessor === "function") {
      return delegate;
    }
  }

  if (typeof provider.addSpanProcessor === "function") {
    return provider;
  }

  return null;
}

export class TracerootClient {
  readonly apiKey: string;
  readonly hostUrl: string;
  readonly flushInterval: number;
  readonly batchSize: number;
  readonly timeout: number;
  readonly enabled: boolean;
  readonly gitRepo?: string;
  readonly gitRef?: string;
  readonly serviceName: string;
  readonly environment: string;

  private readonly integrations: Integration[];
  private readonly customExporter?: SpanExporter;
  private provider: NodeTracerProvider | null = null;
  private processor: BatchSpanProcessor | null = null;
  private instrumentations: Array<{ disable?: () => void }> = [];
  private ownsProvider = false;

  constructor(options: InitializeOptions = {}) {
    const gitContext = autoDetectGitContext();

    this.apiKey = options.apiKey ?? options.api_key ?? process.env[ENV_VARS.API_KEY] ?? "";
    this.hostUrl =
      options.hostUrl ?? options.host_url ?? process.env[ENV_VARS.HOST_URL] ?? DEFAULT_HOST_URL;
    this.flushInterval =
      options.flushInterval ??
      options.flush_interval ??
      Number(process.env[ENV_VARS.FLUSH_INTERVAL] ?? DEFAULT_FLUSH_INTERVAL);
    this.batchSize =
      options.batchSize ??
      options.batch_size ??
      options.flushAt ??
      options.flush_at ??
      Number(process.env[ENV_VARS.FLUSH_AT] ?? DEFAULT_FLUSH_AT);
    this.timeout = options.timeout ?? Number(process.env[ENV_VARS.TIMEOUT] ?? DEFAULT_TIMEOUT);
    this.gitRepo =
      options.gitRepo ?? options.git_repo ?? process.env[ENV_VARS.GIT_REPO] ?? gitContext.gitRepo;
    this.gitRef =
      options.gitRef ?? options.git_ref ?? process.env[ENV_VARS.GIT_REF] ?? gitContext.gitRef;
    this.serviceName =
      options.serviceName ??
      options.service_name ??
      process.env[ENV_VARS.SERVICE_NAME] ??
      DEFAULT_SERVICE_NAME;
    this.environment =
      options.environment ?? process.env[ENV_VARS.ENVIRONMENT] ?? DEFAULT_ENVIRONMENT;
    this.integrations = options.integrations ?? [];
    this.customExporter = options.exporter;
    this.enabled =
      (options.enabled ?? getEnvBoolean(ENV_VARS.ENABLED, true)) &&
      (Boolean(this.apiKey) || Boolean(this.customExporter));

    if (this.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    if (this.processor) {
      return;
    }

    const exporter =
      this.customExporter ??
      new OTLPTraceExporter({
        url: `${this.hostUrl.replace(/\/$/, "")}/api/v1/public/traces`,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "x-traceroot-sdk-name": SDK_NAME,
          "x-traceroot-sdk-version": SDK_VERSION
        },
        timeoutMillis: Math.floor(this.timeout * 1_000)
      });

    this.processor = new BatchSpanProcessor(exporter, {
      maxExportBatchSize: this.batchSize,
      scheduledDelayMillis: Math.floor(this.flushInterval * 1_000)
    });

    const existingProvider = getCurrentMutableProvider();
    if (existingProvider) {
      existingProvider.addSpanProcessor(this.processor);
      this.provider = existingProvider;
      this.ownsProvider = false;
    } else {
      const provider = new NodeTracerProvider({
        resource: new Resource({
          [ATTR_SERVICE_NAME]: this.serviceName,
          [ATTR_SERVICE_VERSION]: SDK_VERSION,
          "traceroot.environment": this.environment
        })
      });

      provider.addSpanProcessor(this.processor);
      provider.register({
        contextManager: new AsyncLocalStorageContextManager().enable()
      });

      this.provider = provider;
      this.ownsProvider = true;
    }

    if (this.provider && this.integrations.length > 0) {
      this.instrumentations = initializeIntegrations(this.provider, this.integrations);
    }
  }

  async flush(): Promise<void> {
    if (this.provider) {
      await this.provider.forceFlush();
    }
  }

  async shutdown(): Promise<void> {
    for (const instrumentation of this.instrumentations) {
      instrumentation.disable?.();
    }
    this.instrumentations = [];

    if (this.ownsProvider && this.provider) {
      await this.provider.shutdown();
    } else if (this.processor) {
      await this.processor.shutdown();
    }

    this.provider = null;
    this.processor = null;
    this.ownsProvider = false;
  }
}
