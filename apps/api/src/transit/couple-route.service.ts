import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { extractStations, findMeetupStation, findOverlapStations } from './route-overlap';
import { TransitService } from './transit.service';

const REDIS_TTL_SECONDS = 3600;
const DB_TTL_HOURS = 24;

interface RouteResult {
  departureTime: string;
  totalTime: number;
  transferCount: number;
  legs: unknown[];
}

export interface CoupleRouteResponse {
  type: 'meetup' | 'individual';
  meetupStation?: { name: string; lat: number; lng: number };
  myRoute: RouteResult;
  partnerDepartureTime?: string;
  noOverlapReason?: string;
  cachedAt: string;
}

@Injectable()
export class CoupleRouteService {
  private readonly logger = new Logger(CoupleRouteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transitService: TransitService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async analyze(eventId: string, userId: string, forceRefresh = false): Promise<CoupleRouteResponse> {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (!event.placeLat || !event.placeLng) throw new BadRequestException('Event has no place coordinates');
    if (!event.appointmentAt) throw new BadRequestException('Event has no appointment time');

    const members = await this.prisma.coupleMember.findMany({
      where: { coupleId: event.coupleId },
      include: { user: { select: { id: true, homeLat: true, homeLng: true, displayName: true } } },
    });

    const me = members.find((m) => m.userId === userId);
    const partner = members.find((m) => m.userId !== userId);
    if (!me) throw new BadRequestException('User is not a member of this couple');
    if (!me.user.homeLat || !me.user.homeLng) throw new BadRequestException('Your home location is not set');
    if (!partner?.user.homeLat || !partner?.user.homeLng) throw new BadRequestException("Partner's home location is not set");

    const cacheKey = this.buildCacheKey(
      eventId, event.appointmentAt.toISOString(),
      me.user.homeLat, me.user.homeLng,
      partner.user.homeLat, partner.user.homeLng,
      event.placeLat, event.placeLng,
    );

    if (!forceRefresh) {
      const cached = await this.checkCache(cacheKey, eventId, userId);
      if (cached) return cached;
    }

    const arrivalTime = this.formatTmapDateTime(event.appointmentAt);

    const [myRouteRaw, partnerRouteRaw] = await Promise.all([
      this.transitService.computeRoute({
        origin: { lat: me.user.homeLat, lon: me.user.homeLng },
        destination: { lat: event.placeLat, lon: event.placeLng },
        arrivalTime,
      }),
      this.transitService.computeRoute({
        origin: { lat: partner.user.homeLat, lon: partner.user.homeLng },
        destination: { lat: event.placeLat, lon: event.placeLng },
        arrivalTime,
      }),
    ]);

    const myItinerary = this.extractBestItinerary(myRouteRaw);
    const partnerItinerary = this.extractBestItinerary(partnerRouteRaw);

    const myStations = extractStations(myItinerary.legs);
    const partnerStations = extractStations(partnerItinerary.legs);
    const overlapStations = findOverlapStations(myStations, partnerStations);
    const meetup = findMeetupStation(overlapStations);

    const myRoute: RouteResult = {
      departureTime: this.calculateDepartureTime(event.appointmentAt, myItinerary.totalTime),
      totalTime: myItinerary.totalTime,
      transferCount: myItinerary.transferCount,
      legs: myItinerary.legs,
    };

    let result: CoupleRouteResponse;

    if (meetup) {
      result = {
        type: 'meetup',
        meetupStation: { name: meetup.name, lat: meetup.lat, lng: meetup.lng },
        myRoute,
        partnerDepartureTime: this.calculateDepartureTime(event.appointmentAt, partnerItinerary.totalTime),
        cachedAt: new Date().toISOString(),
      };
    } else {
      result = {
        type: 'individual',
        noOverlapReason: '겹치는 경로가 없어 각자 이동합니다.',
        myRoute,
        cachedAt: new Date().toISOString(),
      };
    }

    await this.saveCache(cacheKey, eventId, userId, result);
    return result;
  }

  private buildCacheKey(...parts: (string | number)[]): string {
    const raw = parts.join(':');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return `transit:couple-route:${hash}`;
  }

  private async checkCache(cacheKey: string, eventId: string, userId: string): Promise<CoupleRouteResponse | null> {
    try {
      const redisData = await this.redis.get(cacheKey);
      if (redisData) return JSON.parse(redisData) as CoupleRouteResponse;
    } catch (error) { this.logger.warn('Redis cache read failed', error); }

    try {
      const dbCache = await this.prisma.routeCache.findFirst({
        where: { eventId, userId, cacheKey, expiresAt: { gt: new Date() } },
      });
      if (dbCache) {
        const data = dbCache.routeData as unknown as CoupleRouteResponse;
        try { await this.redis.set(cacheKey, JSON.stringify(data), 'EX', REDIS_TTL_SECONDS); } catch { /* ignore */ }
        return data;
      }
    } catch (error) { this.logger.warn('DB cache read failed', error); }

    return null;
  }

  private async saveCache(cacheKey: string, eventId: string, userId: string, data: CoupleRouteResponse): Promise<void> {
    const json = JSON.stringify(data);
    try { await this.redis.set(cacheKey, json, 'EX', REDIS_TTL_SECONDS); } catch (error) { this.logger.warn('Redis cache write failed', error); }
    try {
      const expiresAt = new Date(Date.now() + DB_TTL_HOURS * 3600_000);
      await this.prisma.routeCache.upsert({
        where: { cacheKey },
        create: { eventId, userId, cacheKey, routeData: data as never, expiresAt },
        update: { routeData: data as never, expiresAt },
      });
    } catch (error) { this.logger.warn('DB cache write failed', error); }
  }

  private formatTmapDateTime(date: Date): string {
    const kst = new Date(date.getTime() + 9 * 60 * 60_000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    const h = String(kst.getUTCHours()).padStart(2, '0');
    const min = String(kst.getUTCMinutes()).padStart(2, '0');
    return `${y}${m}${d}${h}${min}`;
  }

  private calculateDepartureTime(appointmentAt: Date, totalTimeMinutes: number): string {
    return new Date(appointmentAt.getTime() - totalTimeMinutes * 60_000).toISOString();
  }

  private extractBestItinerary(routeData: unknown): { totalTime: number; totalWalkTime: number; transferCount: number; legs: Record<string, unknown>[] } {
    const data = routeData as Record<string, unknown>;
    const metaData = data?.metaData as Record<string, unknown> | undefined;
    const plan = metaData?.plan as Record<string, unknown> | undefined;
    const itineraries = plan?.itineraries;
    if (!Array.isArray(itineraries) || itineraries.length === 0) throw new BadRequestException('No transit route found');
    const best = itineraries[0] as Record<string, unknown>;
    return {
      totalTime: (best.totalTime as number) ?? 0,
      totalWalkTime: (best.totalWalkTime as number) ?? 0,
      transferCount: (best.transferCount as number) ?? 0,
      legs: (best.legs as Record<string, unknown>[]) ?? [],
    };
  }
}
