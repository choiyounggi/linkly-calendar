import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import type Redis from 'ioredis';
import crypto from 'node:crypto';
import { DeparturesComputeDto } from './dto/departures-compute.dto';
import { RouteComputeDto } from './dto/route-compute.dto';

type TransitRequestPayload = Record<string, unknown>;

const TMAP_TRANSIT_URL = 'https://apis.openapi.sk.com/transit/routes';
const DEFAULT_BUCKET_MINUTES = 5;
const DEFAULT_TTL_MIN_SECONDS = 120;
const DEFAULT_TTL_MAX_SECONDS = 300;
const DEFAULT_HTTP_TIMEOUT_MS = 12_000;
const KST_OFFSET_MINUTES = 9 * 60;

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

  async computeRoute(payload: RouteComputeDto): Promise<unknown> {
    const { origin, destination, arrivalTime, bucketMinutes } = payload;
    const tmapPayload: TransitRequestPayload = {
      origin,
      destination,
    };

    if (arrivalTime) {
      tmapPayload.reqDttm = arrivalTime;
    }

    return this.fetchWithCache('route', tmapPayload, {
      arrivalTime,
      bucketMinutes,
    });
  }

  async computeDepartures(payload: DeparturesComputeDto): Promise<unknown> {
    const { originA, originB, destination, arrivalTime, bucketMinutes } =
      payload;
    const tmapPayload: TransitRequestPayload = {
      originA,
      originB,
      destination,
    };

    if (arrivalTime) {
      tmapPayload.reqDttm = arrivalTime;
    }

    return this.fetchWithCache('departures', tmapPayload, {
      arrivalTime,
      bucketMinutes,
    });
  }

  private async fetchWithCache(
    scope: string,
    payload: TransitRequestPayload,
    extraKeyData: TransitRequestPayload = {},
  ): Promise<unknown> {
    const bucketInfo = this.getBucketInfo(payload, extraKeyData);
    const cacheKey = this.buildCacheKey(
      scope,
      payload,
      extraKeyData,
      bucketInfo,
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
    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(TMAP_TRANSIT_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          appKey: this.appKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.httpTimeoutMs),
      });
    } catch (error) {
      this.logger.error('Tmap transit API request failed', error as Error);
      throw new BadGatewayException('Tmap transit API request failed');
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      this.logger.error(
        `Tmap transit API failed (${response.status}) ${errorBody}`,
      );
      throw new BadGatewayException('Tmap transit API request failed');
    }

    const responseBody = await response.text();
    try {
      const parsed = JSON.parse(responseBody) as unknown;
      return this.sanitizeTmapResponse(parsed);
    } catch (error) {
      this.logger.error('Failed to parse Tmap response', error as Error);
      throw new BadGatewayException('Tmap transit API response invalid');
    }
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

  private getBucketInfo(
    payload: TransitRequestPayload,
    extraKeyData: TransitRequestPayload,
  ) {
    const bucketMinutes = this.resolveBucketMinutes(extraKeyData.bucketMinutes);
    const timeCandidate = this.extractRequestTime(payload, extraKeyData);
    const baseTime = timeCandidate ? timeCandidate.getTime() : Date.now();
    const bucketMs = bucketMinutes * 60 * 1000;
    const bucketStartMs = Math.floor(baseTime / bucketMs) * bucketMs;
    return {
      bucketKey: bucketStartMs.toString(),
      bucketStartMs,
      bucketMinutes,
    };
  }

  private resolveBucketMinutes(value: unknown) {
    if (value == null) {
      if (!Number.isFinite(this.bucketMinutes) || this.bucketMinutes < 1) {
        throw new BadRequestException('Invalid cache bucket configuration');
      }
      return this.bucketMinutes;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException('Invalid bucketMinutes value');
    }

    const rounded = Math.floor(value);
    if (rounded < 1) {
      throw new BadRequestException('Invalid bucketMinutes value');
    }

    return rounded;
  }

  private extractRequestTime(
    payload: TransitRequestPayload,
    extraKeyData: TransitRequestPayload,
  ) {
    const candidates = [payload.reqDttm, extraKeyData.arrivalTime];

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const parsed = this.parseTmapDateTime(candidate);
        if (!parsed) {
          throw new BadRequestException('Invalid arrivalTime value');
        }
        return parsed;
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

    const utcMs =
      Date.UTC(year, month, day, hour, minute, second) -
      KST_OFFSET_MINUTES * 60 * 1000;
    return new Date(utcMs);
  }

  private buildCacheKey(
    scope: string,
    payload: TransitRequestPayload,
    extraKeyData: TransitRequestPayload,
    bucketInfo: {
      bucketKey: string;
      bucketStartMs: number;
      bucketMinutes: number;
    },
  ) {
    const keyPayload = this.omitKeys(payload, ['reqDttm']);
    const keyExtra = this.omitKeys(extraKeyData, ['arrivalTime']);
    const raw = this.stableStringify({
      payload: keyPayload,
      extraKeyData: keyExtra,
      bucketStartMs: bucketInfo.bucketStartMs,
      bucketMinutes: bucketInfo.bucketMinutes,
    });
    const digest = crypto.createHash('sha256').update(raw).digest('hex');
    return `transit:${scope}:bucket:${bucketInfo.bucketKey}:${digest}`;
  }

  private omitKeys(
    value: TransitRequestPayload,
    keys: string[],
  ): TransitRequestPayload {
    const entries = Object.entries(value).filter(
      ([key]) => !keys.includes(key),
    );
    return Object.fromEntries(entries) as TransitRequestPayload;
  }

  private sanitizeTmapResponse(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;

    const metaData = (body as Record<string, unknown>).metaData as
      | Record<string, unknown>
      | undefined;
    const plan = metaData?.plan as Record<string, unknown> | undefined;
    const itineraries = plan?.itineraries;
    if (!Array.isArray(itineraries)) return body;

    const safeItineraries = itineraries.map((itinerary) => {
      if (!itinerary || typeof itinerary !== 'object') return null;
      const typed = itinerary as Record<string, unknown>;
      return {
        totalTime: typed.totalTime,
        totalWalkTime: typed.totalWalkTime,
        transferCount: typed.transferCount,
      };
    });

    return {
      metaData: {
        plan: {
          itineraries: safeItineraries,
        },
      },
    };
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
