# CSS Decomposition + Design Tokens Plan

## Overview

Implement design tokens for spacing/typography AND decompose monolithic CSS files to enable scalable UI magnification feature (4 levels: Small/Medium/Large/X-Large).

**Current State:**
- 11,255 total CSS lines across 4 files
- 9,683 lines in single monolithic `CineGenBaseGUI.css`
- Only colors/gradients tokenized (115 lines)
- 1,646+ hardcoded `px` values in main CSS

**Target State:**
- Full design token system (spacing, typography, dimensions)
- Decomposed CSS by component/domain
- Trivial magnification via scaling 50 tokens instead of 2,406+ values

---

## Implementation Status

### Phase 1: Design Token Extraction ✅ Complete
- ✅ `css/tokens/spacing.css` - Created with common spacing values
- ✅ `css/tokens/typography.css` - Created with font size values  
- ✅ `css/tokens/dimensions.css` - Created with border radius/size values
- ✅ `css/tokens/index.css` - Created to aggregate all tokens
- ✅ Extended `css/CineGenBaseGUI-tokens.css` with additional tokens

### Phase 2: Magnification Service ✅ Complete
- ✅ `src/services/magnification.ts` - Runtime scaling service
- ✅ `css/magnification-tokens.css` - Token definitions for CSS override (now redundant - tokens in CineGenBaseGUI-tokens.css use calc())
- ✅ Added `uiMagnificationLevel` to `src/services/preferences.ts`
- ✅ CSS files converted to use `var(--space-Npx)`, `var(--text-Npx)`, `var(--radius-Npx)`
- ✅ Tokens use `calc(Npx * var(--ui-scale))` for automatic scaling
- ✅ Magnification modal template created
- ✅ Modal registered in toolbar-modals-service.ts

### Phase 3: Remaining Tasks
1. ✅ Convert hardcoded `px` values in CSS to use `var()` tokens (DONE - script converted 1,394 values)
2. ✅ Add UI control in Settings modal (DONE)
3. ✅ Wire up click handlers for magnification selection (DONE)
4. Test transitions and visual scaling (IN PROGRESS - needs runtime testing)

---

## Scale Factors
- **Small**: 1x (current "too small" baseline)
- **Medium**: 1.25x (current × 1.25)
- **Large**: 1.5x
- **X-Large**: 2x

---

## Files Modified
- `css/CineGenBaseGUI-tokens.css` - Added spacing/typography/dimension tokens with calc()
- `css/CineGenBaseGUI.css` - Converted to use var() tokens (1,200 replacements)
- `css/CineGenBaseGUI-controls-extra.css` - Converted to use var() tokens (145 replacements)
- `css/CineGenBaseGUI-button-surfaces.css` - Converted to use var() tokens (49 replacements)
- `src/services/preferences.ts` - Added `uiMagnificationLevel` preference
- `src/services/magnification.ts` - New file, runtime scaling service
- `src/toolbar/toolbar-data.ts` - Added UI Magnification tile
- `src/toolbar/toolbar-modals-service.ts` - Added open/close handlers
- `src/components/modals/templates/magnification-modal.template.ts` - New file
- `src/components/modals/cinegen-app-modals.ts` - Added magnification modal
- `index.html` - Fixed (removed wrapper div)
- `scripts/convert-css-to-use-tokens.mjs` - New file, conversion script

---

## Next Steps
1. Test magnification at runtime (dev server)
2. Verify radius rounding (Math.ceil) works correctly
3. Decompose monolithic CSS files (future enhancement)
4. Add unit tests for magnification service (future enhancement)
