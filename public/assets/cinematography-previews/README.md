# Cinematography preview thumbnails

Static chip previews for the Camera, Lighting & Atmosphere panel.

## Layout

- `prompts.json` — **conventions** + **sectionConventions** + full Grok prompts per item
- `shot-types/` — Shot Types & Framing (640×360 JPG)
- `angles/` — Camera Angles (640×360 JPG)
- `composition/` — Frame Composition (640×360 JPG; grayscale block primitives)
- `lighting/` — Lighting Techniques (640×360 JPG)
- `movements/` — Camera Movements (640×360 JPG)
- `atmosphere/` — Atmospheric Effects (640×360 JPG)

## Shot Types & Framing

See `prompts.json` → `conventions.mannequinIdentity` and `sectionConventions.shotTypes`. Canonical mannequin face is `shot-types/mannequin-identity.jpg` (copied from approved `ms.jpg`). ECU and CU reference this identity plate.

| Abbr | File | Status |
|------|------|--------|
| (identity) | `shot-types/mannequin-identity.jpg` | ✓ identity anchor |
| ECU | `shot-types/ecu.jpg` | ✓ |
| CU | `shot-types/cu.jpg` | ✓ |
| MCU | `shot-types/mcu.jpg` | ✓ |
| MS | `shot-types/ms.jpg` | ✓ identity source |
| MLS | `shot-types/mls.jpg` | ✓ thighs-up / 3/4 |
| Cowboy | `shot-types/cowboy.jpg` | ✓ mid-thigh |
| LS/WS | `shot-types/ls-ws.jpg` | ✓ |
| ELS | `shot-types/els.jpg` | ✓ |

## Camera Angles

See `prompts.json` → `sectionConventions.angles` (fixed medium shot; only camera height/tilt changes).

| Abbr | File | Status |
|------|------|--------|
| Eye-Level | `angles/eye-level.jpg` | ✓ anchor |
| Low Angle | `angles/low-angle.jpg` | ✓ |
| High Angle | `angles/high-angle.jpg` | ✓ |
| Dutch | `angles/dutch.jpg` | ✓ |
| Overhead | `angles/overhead.jpg` | ✓ |
| Worm's Eye | `angles/worms-eye.jpg` | ✓ |
| OTS | `angles/ots.jpg` | ✓ |
| POV | `angles/pov.jpg` | ✓ |

## Frame Composition

See `prompts.json` → `sectionConventions.composition` (grayscale block volume primitives; `base-scene.jpg` anchor passed as `image_paths` for every chip).

| Abbr | File | Status |
|------|------|--------|
| (anchor) | `composition/base-scene.jpg` | ✓ anchor |
| Rule of ⅓ | `composition/rule-of-thirds.jpg` | ✓ |
| Centered | `composition/centered.jpg` | ✓ |
| Asymm. | `composition/asymmetrical.jpg` | ✓ |
| Symm. | `composition/symmetrical.jpg` | ✓ |
| Lead Lines | `composition/leading-lines.jpg` | ✓ |
| Frame² | `composition/frame-within-frame.jpg` | ✓ |
| Neg Space | `composition/negative-space.jpg` | ✓ |
| φ Grid | `composition/phi-grid.jpg` | ✓ |
| FMB | `composition/foreground-mid-back.jpg` | ✓ |
| Diagonal | `composition/diagonal.jpg` | ✓ |
| Tight | `composition/tight.jpg` | ✓ |
| Loose | `composition/loose.jpg` | ✓ |
| Overlap | `composition/overlap.jpg` | ✓ |
| S-Curve | `composition/s-curve.jpg` | ✓ |
| △ Comp | `composition/pyramid-triangular.jpg` | ✓ |
| ○ Comp | `composition/circular.jpg` | ✓ |

## Lighting Techniques

See `prompts.json` → `sectionConventions.lighting` (reference `angles/eye-level.jpg` for mannequin consistency).

| Abbr | File | Status |
|------|------|--------|
| 3-Point | `lighting/3-point.jpg` | ✓ |
| High-Key | `lighting/high-key.jpg` | ✓ |
| Low-Key | `lighting/low-key.jpg` | ✓ |
| Side | `lighting/side.jpg` | ✓ |
| Backlit | `lighting/backlit.jpg` | ✓ |
| Rim | `lighting/rim.jpg` | ✓ |
| Golden Hr | `lighting/golden-hr.jpg` | ✓ |
| Blue Hr | `lighting/blue-hr.jpg` | ✓ |
| Practical | `lighting/practical.jpg` | ✓ |
| Gels | `lighting/gels.jpg` | ✓ |
| Hard | `lighting/hard.jpg` | ✓ |
| Soft | `lighting/soft.jpg` | ✓ |

## Camera Movements

See `prompts.json` → `sectionConventions.movements` (reference `shot-types/ms.jpg`).

| Abbr | File | Status |
|------|------|--------|
| POV Track | `movements/pov-track.jpg` | ✓ |
| Dolly Zoom | `movements/dolly-zoom.jpg` | ✓ |
| Pan | `movements/pan.jpg` | ✓ |
| Tilt | `movements/tilt.jpg` | ✓ |
| Orbit | `movements/orbit.jpg` | ✓ |
| Handheld | `movements/handheld.jpg` | ✓ |
| Steadicam | `movements/steadicam.jpg` | ✓ |
| Zoom | `movements/zoom.jpg` | ✓ |

## Atmospheric Effects

See `prompts.json` → `sectionConventions.atmosphere` (reference `angles/eye-level.jpg`).

| Abbr | File | Status |
|------|------|--------|
| Fog | `atmosphere/fog.jpg` | ✓ |
| Rain | `atmosphere/rain.jpg` | ✓ |
| God Rays | `atmosphere/god-rays.jpg` | ✓ |
| Dust | `atmosphere/dust.jpg` | ✓ |
| Haze | `atmosphere/haze.jpg` | ✓ |
| Smoke | `atmosphere/smoke.jpg` | ✓ |
| Snow | `atmosphere/snow.jpg` | ✓ |
| Heat | `atmosphere/heat.jpg` | ✓ |

## Regenerating

See `prompts.json` → `conventions` for global rules.

1. **Shot types**: Mannequin identity from `shot-types/mannequin-identity.jpg` (derived from `ms.jpg`). ECU/CU reference identity plate; see `consistency.wideShots` for LS/WS and ELS
2. **Camera angles**: Eye-Level anchor first (`angles/eye-level.jpg`); bootstrap from `shot-types/ms.jpg`; reference anchor for other angles
3. **Frame composition**: `composition/base-scene.jpg` anchor first; reference anchor for all 16 chips (grayscale block primitives, not mannequins)
4. **Lighting**: reference `angles/eye-level.jpg` for all 12 chips
5. **Camera movements**: reference `shot-types/ms.jpg` for all 8 chips
6. **Atmospheric effects**: reference `angles/eye-level.jpg` for all 8 chips
7. Downscale to **640×360**, register in `source/src/camera/camera-lighting-previews.ts`
