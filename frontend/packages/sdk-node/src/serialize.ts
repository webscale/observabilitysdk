import type { Span } from "@opentelemetry/api";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function isPrimitiveArray(value: unknown[]): value is Array<string | number | boolean> {
  return value.every((item) => {
    const itemType = typeof item;
    return itemType === "string" || itemType === "number" || itemType === "boolean";
  });
}

function serializeFloat(value: number): number | string {
  if (Number.isNaN(value)) {
    return "NaN";
  }

  if (!Number.isFinite(value)) {
    return value < 0 ? "-Infinity" : "Infinity";
  }

  return value;
}

function serializeObject(value: object, seen: WeakSet<object>): unknown {
  if (seen.has(value)) {
    return `<circular ref: ${(value as { constructor?: { name?: string } }).constructor?.name ?? "Object"}>`;
  }

  seen.add(value);

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof URL) {
    return value.toString();
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    try {
      return value.toString("utf8");
    } catch {
      return "<non-utf8 bytes>";
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeInternal(item, seen));
  }

  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries(), ([key, item]) => [String(key), serializeInternal(item, seen)]),
    );
  }

  if (value instanceof Set) {
    return Array.from(value.values(), (item) => serializeInternal(item, seen));
  }

  if (typeof value === "object" && value !== null && "toJSON" in value) {
    try {
      const jsonValue = (value as { toJSON: () => unknown }).toJSON();
      return serializeInternal(jsonValue, seen);
    } catch {
      // Fall back to property walk below.
    }
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeInternal(item, seen)]),
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 0) {
    return Object.fromEntries(entries.map(([key, item]) => [key, serializeInternal(item, seen)]));
  }

  return String(value);
}

function serializeInternal(value: unknown, seen: WeakSet<object>): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return serializeFloat(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return value.name || "<anonymous>";
  }

  if (value instanceof RegExp) {
    return value.toString();
  }

  return serializeObject(value as object, seen);
}

export function serializeValue(value: unknown): unknown {
  return serializeInternal(value, new WeakSet<object>());
}

export function setSpanAttribute(span: Span, key: string, value: unknown): void {
  if (value == null || !span.isRecording()) {
    return;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    span.setAttribute(key, value);
    return;
  }

  if (Array.isArray(value) && isPrimitiveArray(value) && value.every((item) => typeof item === "string")) {
    span.setAttribute(key, value);
    return;
  }

  span.setAttribute(key, JSON.stringify(serializeValue(value)));
}

export function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as PromiseLike<T>).then === "function"
  );
}
