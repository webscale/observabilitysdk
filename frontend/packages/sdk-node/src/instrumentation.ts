import { registerInstrumentations } from "@opentelemetry/instrumentation";
import type { Instrumentation as OtelInstrumentation } from "@opentelemetry/instrumentation";
import type { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import type { Integration } from "./types";

type InstrumentationRecord = {
  packageName: string;
  targetModule: string;
  exportName: string;
};

const REGISTRY: Record<Integration, InstrumentationRecord> = {
  openai: {
    packageName: "@arizeai/openinference-instrumentation-openai",
    targetModule: "openai",
    exportName: "OpenAIInstrumentation"
  },
  anthropic: {
    packageName: "@arizeai/openinference-instrumentation-anthropic",
    targetModule: "@anthropic-ai/sdk",
    exportName: "AnthropicInstrumentation"
  },
  langchain: {
    packageName: "@arizeai/openinference-instrumentation-langchain",
    targetModule: "@langchain/core/callbacks/manager",
    exportName: "LangChainInstrumentation"
  }
};

function resolveModule(moduleName: string): void {
  try {
    require.resolve(moduleName);
  } catch {
    throw new Error(
      `Cannot instrument ${moduleName}: package is not installed. Install it with \`npm install ${moduleName}\`.`,
    );
  }
}

function loadInstrumentation(
  integration: Integration,
  tracerProvider: NodeTracerProvider,
): OtelInstrumentation {
  const record = REGISTRY[integration];
  resolveModule(record.targetModule);

  const moduleExports = require(record.packageName) as Record<
    string,
    new (...args: any[]) => OtelInstrumentation
  >;
  const InstrumentationClass = moduleExports[record.exportName];

  if (!InstrumentationClass) {
    throw new Error(`Failed to load ${record.exportName} from ${record.packageName}.`);
  }

  const instrumentation = new InstrumentationClass({ tracerProvider }) as OtelInstrumentation & {
    manuallyInstrument?: (moduleExports: unknown) => void;
  };

  try {
    const targetModule = require(record.targetModule);
    instrumentation.manuallyInstrument?.(targetModule.default ?? targetModule);
  } catch {
    // Some packages can still be patched through registerInstrumentations alone.
  }

  return instrumentation;
}

export function initializeIntegrations(
  tracerProvider: NodeTracerProvider,
  integrations: Integration[],
): OtelInstrumentation[] {
  const instrumentations = integrations.map((integration) =>
    loadInstrumentation(integration, tracerProvider),
  );

  if (instrumentations.length > 0) {
    registerInstrumentations({
      instrumentations,
      tracerProvider
    });
  }

  return instrumentations;
}
