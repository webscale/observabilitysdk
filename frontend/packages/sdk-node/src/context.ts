import type { Attributes } from "@opentelemetry/api";
import { context } from "@opentelemetry/api";
import {
  getAttributes,
  getAttributesFromContext,
  setAttributes,
  setMetadata,
  setSession,
  setTags,
  setUser
} from "@arizeai/openinference-core";

import { SpanAttributes } from "./constants";
import { serializeValue } from "./serialize";
import type { UsingAttributesOptions } from "./types";

function stringify(value: unknown): string {
  return JSON.stringify(serializeValue(value));
}

function toTracerootAttributes(options: UsingAttributesOptions): Attributes {
  const userId = options.userId ?? options.user_id;
  const sessionId = options.sessionId ?? options.session_id;
  const attributes: Attributes = { ...(options.attributes ?? {}) };

  if (userId) {
    attributes[SpanAttributes.TRACE_USER_ID] = userId;
    attributes[SpanAttributes.OPENINFERENCE_USER_ID] = userId;
  }

  if (sessionId) {
    attributes[SpanAttributes.TRACE_SESSION_ID] = sessionId;
    attributes[SpanAttributes.OPENINFERENCE_SESSION_ID] = sessionId;
  }

  if (options.metadata) {
    const metadata = stringify(options.metadata);
    attributes[SpanAttributes.SPAN_METADATA] = metadata;
    attributes[SpanAttributes.TRACE_METADATA] = metadata;
  }

  if (options.tags) {
    attributes[SpanAttributes.SPAN_TAGS] = options.tags;
    attributes[SpanAttributes.TRACE_TAGS] = options.tags;
  }

  return attributes;
}

export function usingAttributes<T>(options: UsingAttributesOptions, callback: () => T): T {
  const userId = options.userId ?? options.user_id;
  const sessionId = options.sessionId ?? options.session_id;

  let activeContext = context.active();

  if (userId) {
    activeContext = setUser(activeContext, { userId });
  }

  if (sessionId) {
    activeContext = setSession(activeContext, { sessionId });
  }

  if (options.metadata) {
    activeContext = setMetadata(
      activeContext,
      serializeValue(options.metadata) as Record<string, unknown>,
    );
  }

  if (options.tags) {
    activeContext = setTags(activeContext, options.tags);
  }

  const mergedAttributes = {
    ...(getAttributes(activeContext) ?? {}),
    ...toTracerootAttributes(options)
  };

  if (Object.keys(mergedAttributes).length > 0) {
    activeContext = setAttributes(activeContext, mergedAttributes);
  }

  return context.with(activeContext, callback);
}

export function getCurrentContextAttributes(): Attributes {
  return getAttributesFromContext(context.active());
}
