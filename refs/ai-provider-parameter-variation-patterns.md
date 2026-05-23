# AI Provider Parameter Variation Patterns (Brave Research)

This note summarizes how teams handle cross-provider and cross-model parameter differences in production AI apps.

## Key Finding

Most multi-provider apps do **not** depend on a single static "correct parameter schema" per model. Instead, they use a layered strategy:

1. Normalize to a common request shape.
2. Drop/transform unsupported params per provider/model.
3. Retry adaptively based on runtime errors.
4. Fallback to alternate models/providers when needed.
5. Persist learned overrides.

## What Existing Platforms Do

### 1) Normalize + drop unsupported fields

- LiteLLM supports `drop_params` so unsupported OpenAI-style fields are removed instead of hard-failing requests.
- It also supports provider-specific passthrough fields and explicit drop lists.

Source:

- [LiteLLM - Drop Unsupported Params](https://docs.litellm.ai/docs/completion/drop_params)

### 2) Route only to providers that support requested params (optional strict mode)

- OpenRouter's default behavior can still route requests where some parameters are ignored.
- OpenRouter also supports `require_parameters: true` to only use providers that support all requested parameters.

Sources:

- [OpenRouter - Provider Selection](https://openrouter.ai/docs/guides/routing/provider-selection)
- [OpenRouter - API Reference Overview](https://openrouter.ai/docs/api/reference/overview)

### 3) Fallback-first reliability for capability mismatches

- Vercel AI Gateway treats many model failures (unsupported inputs/params, limits, outages) as fallback triggers and retries on configured alternatives.

Source:

- [Vercel AI Gateway - Model Fallbacks](https://vercel.com/changelog/model-fallbacks-now-available-in-vercel-ai-gateway)

### 4) Metadata helps, but does not fully replace runtime handling

- Model catalogs and parameter docs are useful, but teams still keep adaptive runtime handling because support can vary by backend/provider/region and may drift over time.

Source:

- [OpenRouter - Models Overview](https://openrouter.ai/docs/guides/overview/models)

## Recommended Architecture for CineGen

Use a hybrid system:

1. **Capability cache** (what docs/catalog say is supported).
2. **Preflight sanitizer** (drop/transform before request).
3. **Error-driven adaptation** (parse unsupported-param errors, retry with minimal changes).
4. **Fallback routing** (alternate model/provider).
5. **Persisted overrides** by `(providerTarget, endpoint, modelId)` to avoid repeated failures.

## Why Keep Policy Logic

Even if provider metadata is available, policy/adaptive logic remains necessary because:

- OpenAI-compatible does not mean behavior-identical.
- Parameter support can differ by model variant.
- Providers sometimes ignore unsupported fields; others fail hard.
- Documentation can lag actual behavior.

Policy + adaptive retry is the safety layer used by most mature gateway-based stacks.
