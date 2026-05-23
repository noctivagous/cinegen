import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, '..');
const envExamplePath = resolve(appRoot, 'backends', '.env.example');
const envPath = resolve(appRoot, 'backends', '.env');

if (!existsSync(envPath) && existsSync(envExamplePath)) {
  copyFileSync(envExamplePath, envPath);
  console.log('[cinegen] created backends/.env from .env.example');
}
