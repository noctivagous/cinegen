# AI Model Parameters Reference

## Text (LLM) Parameters

| Parameter | Type | Range/Options | Default | API Field |
|-----------|------|---------------|---------|----------|
| Model | select | from catalog | - | `model` |
| Max Tokens | number | 1-32768 | 500 | `max_tokens` |
| Temperature | number | 0-2 (step 0.1) | 0.7 | `temperature` |
| Top P | number | 0-1 (step 0.01) | 1.0 | `top_p` |
| Frequency Penalty | number | 0-2 (step 0.1) | 0 | `frequency_penalty` |
| Presence Penalty | number | 0-2 (step 0.1) | 0 | `presence_penalty` |
| Stop Sequences | text | comma-separated | - | `stop` |

### Supported Providers:
- OpenAI-compatible (OpenAI, xAI, Groq, Mistral, Together)
- Anthropic Messages API (Claude)
- Google AI / Vertex (Gemini)
- Replicate (Llama, etc.)

---

## Image Parameters

| Parameter | Type | Range/Options | Default | API Field |
|-----------|------|---------------|---------|----------|
| Model | select | from catalog | - | `model` |
| Count (n) | number | 1-10 | 1 | `n` |
| Size | select | 1024x1024, 1792x1024, 1024x1792, 768x1344, 1344x768, 1536x1536 | 1024x1024 | `size` |
| Quality | select | standard, hd | standard | `quality` (DALL-E 3) |
| Style | select | vivid, natural | vivid | `style` (DALL-E 3) |
| Negative Prompt | textarea | free text | - | `negative_prompt` |
| Seed | number | 0-4294967295 | random | `seed` |
| Steps | number | 1-150 | 25 | `num_inference_steps` |
| CFG Scale | number | 0-20 (step 0.5) | 7.5 | `cfg_scale` |

### Supported Providers:
- OpenAI-compatible (DALL-E, GPT Image)
- Google AI (Imagen 4)
- fal.ai (FLUX, Ideogram, Recraft)
- Luma AI (Photon)
- Replicate (FLUX, SDXL)

### Notes:
- **FLUX models**: Recommended to disable CFG (CFG=1) for better results
- **Stable Diffusion**: CFG scale of 7-15 provides best results; sampling steps of 25 is usually enough
- **DALL-E 3**: Supports quality (standard/hd) and style (vivid/natural) parameters

---

## Video Parameters

| Parameter | Type | Range/Options | Default | API Field |
|-----------|------|---------------|---------|----------|
| Model | select | from catalog | - | `model` |
| Duration | number | 2-60 (provider-dependent) | 5 | `duration` |
| Aspect Ratio | select | 16:9, 9:16, 4:3, 3:4, 1:1, 21:9 | 16:9 | `ratio`/`aspect_ratio` |
| Seed | number | 0-4294967295 | random | `seed` |
| CFG Scale | number | 0-10 (step 0.1) | 0.5 | `cfg_scale` |
| Image-to-Video | file | image upload | - | `prompt_image` |

### Supported Providers:
- Google AI (Veo 3.1)
- fal.ai (Kling, WAN, Minimax)
- Runway ML (Gen-4.5)
- Luma AI (Ray 3)
- Replicate (custom models)

### Provider-Specific Notes:

#### Runway Gen-4.5:
- Duration: 2-10 seconds
- Aspect Ratio: 1280:720 (Landscape), 720:1280 (Portrait), 1584:672, 1104:832, 960:960, 832:1104
- Supports image-to-video with motion brush

#### Luma Dream Machine (Ray 3):
- Duration: 5-60 seconds
- Supports text-to-video and image-to-video
- Camera motion control available

#### Kling (via fal.ai):
- Duration: 5-10 seconds (standard), up to 60s (pro)
- CFG Scale: 0.3-0.5 for creative freedom, higher for strict prompt following
- Supports elements referencing for characters/objects
- Multi-shot storyboarding available in Kling 3.0

---

## Audio (TTS) Parameters

| Parameter | Type | Range/Options | Default | API Field |
|-----------|------|---------------|---------|----------|
| Model | select | tts-1, tts-1-hd, etc. | - | `model` |
| Voice | select | alloy, echo, fable, onyx, nova, shimmer, eve | alloy | `voice` |
| Speed | number | 0.25-4.0 (step 0.25) | 1.0 | `speed` |
| Response Format | select | mp3, opus, aac, flac | mp3 | `response_format` |

### Supported Providers:
- ElevenLabs (TTS, SFX, Music)
- OpenAI-compatible (TTS-1, TTS-1 HD)
- Google AI (Lyria music)
- Murf AI (Studio TTS)
- WellSaid Labs (Enterprise TTS)

---

## API Integration

### Proxy Endpoint
All requests go through the local proxy:
```
POST /proxy{v1/chat/completions, /v1/images/generations, etc.}
Headers:
  - Content-Type: application/json
  - X-Cinegen-Target: {provider}
  - X-Cinegen-Base-Url: {base_url} (optional)
```

### Provider Target Mapping
| Provider ID | Target Header |
|-------------|---------------|
| openai-compatible | openai |
| anthropic-messages-api | anthropic |
| google-gemini-api | google |
| elevenlabs-api | elevenlabs |
| fal-ai | fal |
| runway-api | runway |
| luma-api | luma |
| replicate-api | replicate |

---

## Response Formats

### Text (LLM)
```json
{
  "choices": [
    {
      "message": {
        "content": "generated text here"
      }
    }
  ]
}
```

### Image
```json
{
  "data": [
    {
      "b64_json": "base64encoded...",
      "url": "https://..."
    }
  ]
}
```

### Video
```json
{
  "data": [
    {
      "video": {
        "url": "https://..."
      },
      "url": "https://..."
    }
  ]
}
```

### Audio
Returns binary audio file (mp3, opus, etc.) directly.
