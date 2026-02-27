import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const envPath = path.join(root, '.env.local');
const examplePath = path.join(root, '.env.example');

const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';

const hasKey = /CHAT_ENCRYPTION_KEYS=/.test(existing);
const hasPort = /\bPORT=/.test(existing);
const hasApiUrl = /NEXT_PUBLIC_API_URL=/.test(existing);

let content = existing.trim();
if (content.length) content += '\n\n';

if (!hasPort) {
  content += 'PORT=3001\n';
}

if (!hasApiUrl) {
  content += 'NEXT_PUBLIC_API_URL=http://localhost:3001\n';
}

if (!hasKey) {
  const key = randomBytes(32).toString('base64');
  content += `CHAT_ENCRYPTION_KEYS=1:${key}\nCHAT_ENCRYPTION_KEY_VERSION=1\n`;
}

if (existsSync(examplePath)) {
  const example = readFileSync(examplePath, 'utf8');
  if (!/TMAP_APP_KEY=/.test(content) && /TMAP_APP_KEY=/.test(example)) {
    content += 'TMAP_APP_KEY=\n';
  }
}

writeFileSync(envPath, content.trim() + '\n');
console.log(`✅ .env.local updated at ${envPath}`);
