#!/usr/bin/env node
/**
 * Convert hardcoded px values in CSS to use CSS custom properties for magnification.
 * Run after editing CSS, before build.
 */
import fs from 'fs';
import path from 'path';

const cssFiles = [
  'css/CineGenBaseGUI.css',
  'css/CineGenBaseGUI-controls-extra.css',
  'css/CineGenBaseGUI-button-surfaces.css',
].filter(f => fs.existsSync(f));

const pxValues = [1,2,3,4,5,6,8,9,10,11,12,13,14,15,16,18,20,22,24,28,30,32,36,40,44,48,52,56,60,64,72,80,120,140,180,200,220,240];

// Read each file and replace px values with var() references
for (const file of cssFiles) {
  let css = fs.readFileSync(file, 'utf8');
  const lines = css.split('\n');
  const newLines: string[] = [];
  
  for (const line of lines) {
    let newLine = line;
    // Match patterns like: 11px, 12px, etc.
    for (const px of pxValues) {
      // Don't replace already-tokenized values
      if (line.includes('var(--') || line.includes('rpx') || line.includes('px-')) continue;
      
      // Replace in property values (margin, padding, font-size, etc.)
      const patterns = [
        new RegExp(`(${px}px)`, 'g'), // Just the value
      ];
      
      pxValues.forEach(s => {
        if (line.includes(`--space-${s}px`) || line.includes(`--text-${s}px`) || line.includes(`--radius-${s}px`)) return;
      });
      
      // Only replace actual values (not in comments or already tokenized)
      if (!line.includes('/*') && !line.includes('//')) {
        // font-size: 11px -> font-size: var(--text-11px)
        newLine = newLine.replace(/font-size:\s*(\d+)px/g, 'font-size: var(--text-$1px)');
        // margin/padding: 11px -> 11px (we'll use calc with --ui-scale)
        // border-radius: 4px -> var(--radius-4px)
        newLine = newLine.replace(/border-radius:\s*(\d+)px/g, 'border-radius: var(--radius-$1px)');
      }
    }
    newLines.push(newLine);
  }
  
  fs.writeFileSync(file, newLines.join('\n'), 'utf8');
}

console.log('CSS tokenization complete.');