import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, avatarUrl: true, homeLat: true, homeLng: true, homeAddress: true, homeUpdatedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');

    const homeChanged = dto.homeLat !== undefined || dto.homeLng !== undefined;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.homeLat !== undefined && { homeLat: dto.homeLat }),
        ...(dto.homeLng !== undefined && { homeLng: dto.homeLng }),
        ...(dto.homeAddress !== undefined && { homeAddress: dto.homeAddress }),
        ...(homeChanged && { homeUpdatedAt: new Date() }),
      },
      select: { id: true, email: true, displayName: true, avatarUrl: true, homeLat: true, homeLng: true, homeAddress: true, homeUpdatedAt: true },
    });

    if (homeChanged) {
      await this.invalidateCoupleRouteCaches(userId);
    }
    return updated;
  }

  private async invalidateCoupleRouteCaches(userId: string) {
    try {
      const memberships = await this.prisma.coupleMember.findMany({ where: { userId }, select: { coupleId: true } });
      for (const { coupleId } of memberships) {
        const events = await this.prisma.calendarEvent.findMany({ where: { coupleId }, select: { id: true } });
        const eventIds = events.map((e) => e.id);
        if (eventIds.length > 0) {
          const caches = await this.prisma.routeCache.findMany({
            where: { eventId: { in: eventIds } },
            select: { cacheKey: true },
          });
          if (caches.length > 0) {
            const keys = caches.map((c) => c.cacheKey);
            try { await this.redis.del(...keys); } catch { /* Redis failure non-fatal */ }
            await this.prisma.routeCache.deleteMany({ where: { eventId: { in: eventIds } } });
            this.logger.log(`Invalidated ${keys.length} route caches for couple ${coupleId} (home changed)`);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to invalidate couple route caches', error);
    }
  }
}
