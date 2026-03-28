# TraceRoot TypeScript SDK

Node.js SDK for sending TraceRoot spans to the platform's OTLP ingestion endpoint.

## Current API

- `initialize(options)`
- `observe(fn, options)` or `@observe(options)` for class methods
- `usingAttributes(attributes, callback)`
- `updateCurrentSpan(options)`
- `updateCurrentTrace(options)`
- `flush()`
- `shutdown()`

## Package Path

This workspace package lives at `frontend/packages/sdk-node` and is published as `traceroot-sdk-ts`.
