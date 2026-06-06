#!/usr/bin/env node
/**
 * CSS Magnification Preprocessor
 * 
 * This script reads CSS files and generates scaled values for the --ui-scale variable.
 * It creates CSS custom properties that can be used to override hardcoded values.
 * 
 * Run: node scripts/css-magnification-preprocess.mjs
 */

import fs from 'fs';
import path from 'path';

const CSS_DIR = 'css';
const OUTPUT_FILE = 'css/magnification-values.css';

const SCALE_FACTORS = [1, 1.25, 1.5, 2];
const SPACING_VALUES = [2, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 52, 56, 64, 72, 80];

const TYPOGRAPHY_VALUES = [8, 9, 10, 11, 12, 13, 15, 18, 20, 24, 28, 40, 48];

const RADIUS_VALUES = [2, 3, 4, 6];

// Generate CSS with all scale values
let css = '/* Auto-generated CSS values for UI magnification */\n';
css += ':root {\n';

// Spacing tokens
SPACING_VALUES.forEach(px => {
  SCALE_FACTORS.forEach((factor, level) => {
    const scaled = px * factor;
    css += `  --space-${px}px-${level}x: ${scaled}px;\n`;
  });
});

// Typography tokens
TYPOGRAPHY_VALUES.forEach(px => {
  SCALE_FACTORS.forEach((factor, level) => {
    const scaled = px * factor;
    css += `  --text-${px}px-${level}x: ${scaled}px;\n`;
  });
});

// Radius tokens (rounded up)
RADIUS_VALUES.forEach(px => {
  SCALE_FACTORS.forEach((factor, level) => {
    const scaled = Math.ceil(px * factor);
    css += `  --radius-${px}px-${level}x: ${scaled}px;\n`;
  });
});

css += '}\n';

// Write output
fs.writeFileSync(path.resolve(OUTPUT_FILE), css);
console.log(`Generated ${OUTPUT_FILE} with ${Object.keys(SCALE_FACTORS).length} scale levels`);