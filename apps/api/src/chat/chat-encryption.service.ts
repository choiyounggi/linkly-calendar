import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
};

@Injectable()
export class ChatEncryptionService {
  private readonly logger = new Logger(ChatEncryptionService.name);
  private readonly keys = new Map<number, Buffer>();
  private readonly activeVersion: number;

  constructor(private readonly configService: ConfigService) {
    const activeVersionRaw = this.getEnv('CHAT_ENCRYPTION_KEY_VERSION');
    const activeVersion = Number.parseInt(activeVersionRaw ?? '1', 10);
    this.activeVersion = Number.isNaN(activeVersion) ? 1 : activeVersion;

    const keysEnv = this.getEnv('CHAT_ENCRYPTION_KEYS')?.trim();
    const legacyKey = this.getEnv('CHAT_ENCRYPTION_KEY')?.trim();

    this.logger.log(
      `Chat encryption env loaded (CHAT_ENCRYPTION_KEYS present: ${Boolean(keysEnv)}).`,
    );

    if (keysEnv) {
      for (const entry of keysEnv.split(',').map((value) => value.trim())) {
        if (!entry) continue;
        const [versionRaw, keyRaw] = entry.split(':');
        if (!versionRaw || !keyRaw) continue;
        const version = Number.parseInt(versionRaw, 10);
        if (Number.isNaN(version)) continue;
        const key = this.decodeKey(keyRaw);
        this.keys.set(version, key);
      }
    } else if (legacyKey) {
      this.keys.set(this.activeVersion, this.decodeKey(legacyKey));
    }

    if (!this.keys.size) {
      throw new Error(
        'Chat encryption key is missing. Checked config/env vars: CHAT_ENCRYPTION_KEYS, CHAT_ENCRYPTION_KEY. Run `pnpm init:env` and set one of these variables.',
      );
    }

    if (!this.keys.has(this.activeVersion)) {
      throw new Error(
        `Active chat encryption key version ${this.activeVersion} is missing in CHAT_ENCRYPTION_KEYS.`,
      );
    }
  }

  encrypt(plaintext: Record<string, unknown>): EncryptedPayload {
    const iv = crypto.randomBytes(12);
    const key = this.getKey(this.activeVersion);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const payload = Buffer.from(JSON.stringify(plaintext), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      keyVersion: this.activeVersion,
    };
  }

  decrypt(payload: EncryptedPayload): Record<string, unknown> {
    const key = this.getKey(payload.keyVersion);
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return JSON.parse(plaintext.toString('utf8')) as Record<string, unknown>;
  }

  private getKey(version: number) {
    const key = this.keys.get(version);
    if (!key) {
      throw new Error(`Missing chat encryption key for version ${version}.`);
    }
    return key;
  }

  private decodeKey(raw: string) {
    const trimmed = raw.trim();
    const isHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === 64;
    const buffer = Buffer.from(trimmed, isHex ? 'hex' : 'base64');

    if (buffer.length !== 32) {
      throw new Error(
        'Chat encryption key must be 32 bytes (base64 or 64-char hex).',
      );
    }

    return buffer;
  }

  private getEnv(name: string): string | undefined {
    return this.configService.get<string>(name) ?? process.env[name];
  }
}
