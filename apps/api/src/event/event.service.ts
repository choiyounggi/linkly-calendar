import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async create(dto: CreateEventDto) {
    await this.ensureCoupleMember(dto.coupleId, dto.createdByUserId);
    return this.prisma.calendarEvent.create({
      data: {
        coupleId: dto.coupleId,
        title: dto.title,
        placeName: dto.placeName,
        placeAddress: dto.placeAddress,
        placeLat: dto.placeLat,
        placeLng: dto.placeLng,
        appointmentAt: dto.appointmentAt ? new Date(dto.appointmentAt) : null,
        detail: dto.detail,
        createdByUserId: dto.createdByUserId,
      },
    });
  }

  async findByMonth(query: EventQueryDto) {
    await this.ensureCoupleMember(query.coupleId, query.userId);
    const where: Record<string, unknown> = { coupleId: query.coupleId };
    if (query.month) {
      const [year, month] = query.month.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      where.appointmentAt = { gte: start, lt: end };
    }
    return this.prisma.calendarEvent.findMany({ where, orderBy: { appointmentAt: 'asc' } });
  }

  async findById(id: string, userId: string) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    await this.ensureCoupleMember(event.coupleId, userId);
    return event;
  }

  async update(id: string, userId: string, dto: UpdateEventDto) {
    const event = await this.findById(id, userId);
    const placeOrTimeChanged = dto.placeLat !== undefined || dto.placeLng !== undefined || dto.appointmentAt !== undefined;

    const updated = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.placeName !== undefined && { placeName: dto.placeName }),
        ...(dto.placeAddress !== undefined && { placeAddress: dto.placeAddress }),
        ...(dto.placeLat !== undefined && { placeLat: dto.placeLat }),
        ...(dto.placeLng !== undefined && { placeLng: dto.placeLng }),
        ...(dto.appointmentAt !== undefined && { appointmentAt: dto.appointmentAt ? new Date(dto.appointmentAt) : null }),
        ...(dto.detail !== undefined && { detail: dto.detail }),
      },
    });

    if (placeOrTimeChanged) {
      await this.invalidateRouteCaches(id);
    }
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findById(id, userId);
    await this.prisma.calendarEvent.delete({ where: { id } });
  }

  private async invalidateRouteCaches(eventId: string) {
    try {
      const caches = await this.prisma.routeCache.findMany({
        where: { eventId },
        select: { cacheKey: true },
      });
      if (caches.length > 0) {
        const keys = caches.map((c) => c.cacheKey);
        try { await this.redis.del(...keys); } catch { /* Redis failure non-fatal */ }
        await this.prisma.routeCache.deleteMany({ where: { eventId } });
        this.logger.log(`Invalidated ${keys.length} route caches for event ${eventId}`);
      }
    } catch (error) {
      this.logger.error('Failed to invalidate route caches', error);
    }
  }

  private async ensureCoupleMember(coupleId: string, userId: string) {
    const member = await this.prisma.coupleMember.findUnique({
      where: { coupleId_userId: { coupleId, userId } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('User is not a member of this couple.');
  }
}
