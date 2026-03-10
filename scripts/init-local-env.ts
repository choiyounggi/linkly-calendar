import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const envPath = path.join(root, '.env.local');
const examplePath = path.join(root, '.env.example');

const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';

// .env.example을 기반으로 모든 변수를 복사한 뒤, 특정 값만 오버라이드
if (!existing.trim() && existsSync(examplePath)) {
  // 최초 생성: .env.example 전체를 복사한 뒤 필요한 값만 치환
  let content = readFileSync(examplePath, 'utf8');

  // NODE_ENV 추가 (없으면)
  if (!/\bNODE_ENV=/.test(content)) {
    content = `NODE_ENV=development\n${content}`;
  }

  // 채팅 암호화 키를 실제 랜덤 값으로 치환
  const key = randomBytes(32).toString('base64');
  content = content.replace(
    /CHAT_ENCRYPTION_KEYS=.*/,
    `CHAT_ENCRYPTION_KEYS=1:${key}`,
  );

  writeFileSync(envPath, content.trim() + '\n');
  console.log(`✅ .env.local 생성 완료: ${envPath}`);
} else {
  // 기존 파일이 있으면 누락된 변수만 추가
  let content = existing.trim();
  if (content.length) content += '\n\n';

  const hasKey = (key: string) => new RegExp(`\\b${key}=`).test(content);

  if (!hasKey('NODE_ENV')) {
    content += 'NODE_ENV=development\n';
  }

  if (!hasKey('PORT')) {
    content += 'PORT=3001\n';
  }

  if (!hasKey('NEXT_PUBLIC_API_URL')) {
    content += 'NEXT_PUBLIC_API_URL=http://localhost:3001\n';
  }

  if (!hasKey('CHAT_ENCRYPTION_KEYS')) {
    const key = randomBytes(32).toString('base64');
    content += `CHAT_ENCRYPTION_KEYS=1:${key}\nCHAT_ENCRYPTION_KEY_VERSION=1\n`;
  }

  // .env.example에서 누락된 키를 자동 보충
  if (existsSync(examplePath)) {
    const example = readFileSync(examplePath, 'utf8');
    const missingKeys = [
      'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'DATABASE_URL',
      'REDIS_HOST', 'REDIS_PORT', 'REDIS_DB', 'REDIS_PASSWORD',
      'TMAP_APP_KEY', 'TMAP_HTTP_TIMEOUT_MS',
      'CACHE_BUCKET_MINUTES', 'CACHE_TTL_SECONDS_MIN', 'CACHE_TTL_SECONDS_MAX',
      'CHAT_WS_PING_INTERVAL_MS', 'CHAT_WS_PONG_TIMEOUT_MS',
      'CORS_ORIGINS',
    ];
    for (const mk of missingKeys) {
      if (!hasKey(mk)) {
        const match = example.match(new RegExp(`^${mk}=(.*)$`, 'm'));
        if (match) {
          content += `${mk}=${match[1]}\n`;
        }
      }
    }
  }

  writeFileSync(envPath, content.trim() + '\n');
  console.log(`✅ .env.local 업데이트 완료: ${envPath}`);
}
