# AI Parameter Policy Pass

This note documents the AI request parameter policy pass used by CineGen to keep payloads provider-safe as we add more vendors and models.

## Purpose

The policy pass runs before each AI proxy request and:

- Removes empty values (`undefined`, `null`, `''`).
- Normalizes field names and formats where provider APIs differ.
- Drops known-unsupported parameters for specific provider/model combinations.
- Emits debug log notes showing exactly what was normalized or dropped.

This gives us a stable baseline while allowing incremental rule updates as we validate new providers.

## Where It Runs

Policy module:

- `source/src/services/ai/param-policy.ts`

Wired into request services:

- `source/src/services/ai/chat-service.ts`
- `source/src/services/ai/image-generation-service.ts`
- `source/src/services/ai/audio-generation-service.ts`
- `source/src/services/ai/video-generation-service.ts`

Vendor target resolution shared with proxy header logic:

- `source/src/services/ai/provider-router.ts` (`resolveVendorTarget`)

## Flow

1. Service builds a modality-specific request body.
2. Service calls `sanitizeParamPolicy({ capability, endpoint, vendor, model, body })`.
3. Sanitized body is sent to `proxyJsonRequest` or `proxyBinaryRequest`.
4. `emitParamPolicyLog(...)` writes any normalization/drop notes into the AI interaction log.

## Current Rules (Initial Foundation)

### Global

- Remove empty values from all payloads before send.

### Together AI - Image (`/v1/images/generations`)

- Convert `size` to model-appropriate shape:
  - Kontext/Schnell: prefer `aspect_ratio` when derivable.
  - Other families: use `width`/`height`.
- Convert `response_format: b64_json` -> `base64`.
- Convert `cfg_scale` -> `guidance_scale`.

### Together AI - Audio (`/v1/audio/speech`)

- Drop `speed` (to avoid known param mismatch issues in current compatibility path).
- Convert `response_format: pcm` -> `raw`.

### Together AI - Video (`/v2/videos`)

- Normalize `resolution` suffix to uppercase `P` (example: `720p` -> `720P`).
- Drop `guidance_scale` for `minimax/video-01-director` (known unsupported).
- Normalize `minimax/video-01-director` to known-safe request shape:
  - `seconds` forced to `5`.
  - `resolution` forced to `720P`.

### xAI - Video (`/v1/videos/generations`)

- Clamp `duration` to `1..15`.

## Debug Logging Behavior

Policy logs are emitted as informational AI interaction entries, for example:

- `Param policy normalized (...)`
- `Param policy dropped (...)`

These logs explain request shaping decisions directly in the debug modal activity stream.

## Extending Rules for New Providers

When adding a new provider/model rule:

1. Add normalization/drop logic in `param-policy.ts`.
2. Keep changes scoped by:
   - `target` (resolved provider target),
   - `endpoint` (chat/images/audio/video variant),
   - and model ID/family where needed.
3. Prefer transform/drop over hard failure when a parameter is optional.
4. Emit logs for every non-trivial mutation.
5. Capture source docs and failing payload examples in this file (or adjacent refs) so rules stay traceable.

## Research References

- [Together OpenAI compatibility](https://docs.together.ai/docs/openai-api-compatibility)
- [Together video parameters](https://docs.together.ai/docs/inference/videos/parameters)
- [Together video overview](https://docs.together.ai/docs/inference/videos/overview)
- [Together text-to-speech](https://docs.together.ai/docs/text-to-speech)
- [xAI video generation](https://docs.x.ai/developers/model-capabilities/video/generation)
- [OpenAI text-to-speech guide](https://developers.openai.com/api/docs/guides/text-to-speech)
- [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation)
