#!/usr/bin/env node
/**
 * Convert hardcoded px values in CSS to use CSS custom properties for magnification.
 * Run this script to automate the bulk of the conversion.
 */

import fs from 'fs';
import path from 'path';

const CSS_FILES = [
  'css/CineGenBaseGUI.css',
  'css/CineGenBaseGUI-controls-extra.css',
  'css/CineGenBaseGUI-button-surfaces.css',
];

// Map of px values to their token types
const SPACING_PROPERTIES = ['margin', 'padding', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'gap', 'grid-gap', 'border-width'];
const TYPOGRAPHY_PROPERTIES = ['font-size'];
const RADIUS_PROPERTIES = ['border-radius'];

function convertCssFile(filePath: string): void {
  let css = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  
  // Process each line
  const lines = css.split('\n');
  const newLines = lines.map(line => {
    let newLine = line;
    
    // Skip commented lines and lines that already use var()
    if (line.trim().startsWith('/*') || line.trim().startsWith('//') || line.includes('var(--')) {
      return line;
    }
    
    // Convert font-size: Npx -> font-size: var(--text-Npx)
    TYPOGRAPHY_PROPERTIES.forEach(prop => {
      const regex = new RegExp(`(${prop}\\s*:\\s*)(\\d+)px`, 'g');
      if (regex.test(newLine)) {
        newLine = newLine.replace(regex, `$1var(--text-$2px)`);
        changes++;
      }
    });
    
    // Convert border-radius: Npx -> border-radius: var(--radius-Npx)
    RADIUS_PROPERTIES.forEach(prop => {
      const regex = new RegExp(`(${prop}\\s*:\\s*)(\\d+)px`, 'g');
      if (regex.test(newLine)) {
        newLine = newLine.replace(regex, `$1var(--radius-$2px)`);
        changes++;
      }
    });
    
    // Convert spacing properties: Npx -> var(--space-Npx)
    // This is more complex - only convert standalone px values in spacing props
    SPACING_PROPERTIES.forEach(prop => {
      // Match property: Npx or property: Npx Npx Npx Npx
      const regex = new RegExp(`(${prop}\\s*:\\s*)(\\d+)px`, 'g');
      let match;
      while ((match = regex.exec(newLine)) !== null) {
        const pxValue = match[2];
        const before = match[1];
        const replacement = `${before}var(--space-${pxValue}px)`;
        newLine = newLine.replace(match[0], replacement);
        changes++;
      }
    });
    
    return newLine;
  });
  
  if (changes > 0) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
    console.log(`✓ ${path.basename(filePath)}: ${changes} conversion(s)`);
  } else {
    console.log(`○ ${path.basename(filePath)}: no conversions needed`);
  }
}

console.log('Converting CSS to use design tokens...\n');
CSS_FILES.forEach(convertCssFile);
console.log('\nDone! Run `npm run build` to verify.');
