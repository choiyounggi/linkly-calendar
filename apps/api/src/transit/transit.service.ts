import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import crypto from 'node:crypto';

type TransitRequestPayload = Record<string, unknown>;

type TransitDeparturesRequest = TransitRequestPayload & {
  arrivalBy?: boolean;
  arrivalTime?: string;
  departureTime?: string;
};

const TMAP_TRANSIT_URL = 'https://apis.openapi.sk.com/transit/routes';
const DEFAULT_BUCKET_MINUTES = 5;
const DEFAULT_TTL_MIN_SECONDS = 120;
const DEFAULT_TTL_MAX_SECONDS = 300;
const DEFAULT_HTTP_TIMEOUT_MS = 12_000;

@Injectable()
export class TransitService implements OnModuleDestroy {
  private readonly logger = new Logger(TransitService.name);
  private readonly appKey = process.env.TMAP_APP_KEY ?? '';
  private readonly bucketMinutes = Number.parseInt(
    process.env.CACHE_BUCKET_MINUTES ?? `${DEFAULT_BUCKET_MINUTES}`,
    10,
  );
  private readonly ttlMinSeconds = Number.parseInt(
    process.env.CACHE_TTL_SECONDS_MIN ?? `${DEFAULT_TTL_MIN_SECONDS}`,
    10,
  );
  private readonly ttlMaxSeconds = Number.parseInt(
    process.env.CACHE_TTL_SECONDS_MAX ?? `${DEFAULT_TTL_MAX_SECONDS}`,
    10,
  );
  private readonly httpTimeoutMs = Number.parseInt(
    process.env.TMAP_HTTP_TIMEOUT_MS ?? `${DEFAULT_HTTP_TIMEOUT_MS}`,
    10,
  );

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    if (!this.appKey) {
      this.logger.warn('TMAP_APP_KEY is missing. Transit requests will fail.');
    }
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch (error) {
      this.logger.warn('Failed to close Redis connection', error as Error);
    }
  }

  async computeRoute(payload: TransitRequestPayload): Promise<unknown> {
    return this.fetchWithCache('route', payload);
  }

  async computeDepartures(payload: TransitDeparturesRequest): Promise<unknown> {
    const { arrivalBy, arrivalTime, departureTime, ...tmapPayload } = payload;

    // NOTE: The official Tmap Transit docs only show `reqDttm` as the request time.
    // Arrival-by support is not clearly documented in public docs, so we map
    // arrivalBy + arrivalTime/departureTime into `reqDttm` as a best-effort.
    // Docs: https://transit.tmapmobility.com/guide/procedure
    if (!('reqDttm' in tmapPayload)) {
      const requestedTime = arrivalBy ? arrivalTime : departureTime;
      if (requestedTime) {
        tmapPayload.reqDttm = requestedTime;
      }
    }

    return this.fetchWithCache('departures', tmapPayload, {
      arrivalBy,
      arrivalTime,
      departureTime,
    });
  }

  private async fetchWithCache(
    scope: string,
    payload: TransitRequestPayload,
    extraKeyData: TransitRequestPayload = {},
  ): Promise<unknown> {
    const bucketKey = this.getBucketKey(payload, extraKeyData);
    const cacheKey = this.buildCacheKey(
      scope,
      payload,
      extraKeyData,
      bucketKey,
    );

    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.callTmap(payload);

    await this.setCache(cacheKey, response);

    return response;
  }

  private async callTmap(payload: TransitRequestPayload): Promise<unknown> {
    const response = await fetch(TMAP_TRANSIT_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        appKey: this.appKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.httpTimeoutMs),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `Tmap transit API failed (${response.status}) ${errorBody}`,
      );
      throw new Error('Tmap transit API request failed');
    }

    return (await response.json()) as unknown;
  }

  private async getCache(key: string): Promise<unknown> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as unknown;
    } catch (error) {
      this.logger.warn('Redis cache read failed', error as Error);
      return null;
    }
  }

  private async setCache(key: string, value: unknown): Promise<void> {
    try {
      const ttl = this.getRandomTtlSeconds();
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      this.logger.warn('Redis cache write failed', error as Error);
    }
  }

  private getBucketKey(
    payload: TransitRequestPayload,
    extraKeyData: TransitRequestPayload,
  ) {
    const timeCandidate = this.extractRequestTime(payload, extraKeyData);
    const baseTime = timeCandidate ? timeCandidate.getTime() : Date.now();
    const bucketMs = this.bucketMinutes * 60 * 1000;
    return Math.floor(baseTime / bucketMs).toString();
  }

  private extractRequestTime(
    payload: TransitRequestPayload,
    extraKeyData: TransitRequestPayload,
  ) {
    const candidates = [
      payload.reqDttm,
      extraKeyData.arrivalTime,
      extraKeyData.departureTime,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const parsed = this.parseTmapDateTime(candidate);
        if (parsed) return parsed;
      }
    }

    return null;
  }

  private parseTmapDateTime(value: string) {
    const normalized = value.replace(/[^0-9]/g, '');
    if (!/^[0-9]{12,14}$/.test(normalized)) return null;

    const year = Number.parseInt(normalized.slice(0, 4), 10);
    const month = Number.parseInt(normalized.slice(4, 6), 10) - 1;
    const day = Number.parseInt(normalized.slice(6, 8), 10);
    const hour = Number.parseInt(normalized.slice(8, 10), 10);
    const minute = Number.parseInt(normalized.slice(10, 12), 10);
    const second =
      normalized.length >= 14
        ? Number.parseInt(normalized.slice(12, 14), 10)
        : 0;

    return new Date(year, month, day, hour, minute, second);
  }

  private buildCacheKey(
    scope: string,
    payload: TransitRequestPayload,
    extraKeyData: TransitRequestPayload,
    bucketKey: string,
  ) {
    const raw = this.stableStringify({ payload, extraKeyData });
    const digest = crypto.createHash('sha256').update(raw).digest('hex');
    return `transit:${scope}:bucket:${bucketKey}:${digest}`;
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(
        ([a], [b]) => a.localeCompare(b),
      );
      return `{${entries
        .map(([key, val]) => `"${key}":${this.stableStringify(val)}`)
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }

  private getRandomTtlSeconds() {
    const min = Math.max(this.ttlMinSeconds, 1);
    const max = Math.max(this.ttlMaxSeconds, min);
    if (min === max) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
