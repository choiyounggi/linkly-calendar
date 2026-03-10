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
      select: { id: true, email: true, displayName: true, avatarUrl: true, birthday: true, homeLat: true, homeLng: true, homeAddress: true, homeUpdatedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** 사용자 상태: 커플 여부 + 집주소 등록 여부 */
  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, homeAddress: true, homeLat: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const membership = await this.prisma.coupleMember.findUnique({
      where: { userId },
      select: { coupleId: true },
    });

    return {
      userId: user.id,
      hasCouple: Boolean(membership),
      coupleId: membership?.coupleId ?? null,
      hasHomeAddress: Boolean(user.homeAddress && user.homeLat),
    };
  }

  /** 이메일로 사용자 검색 (초대용) */
  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });
    return user;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');

    const homeChanged = dto.homeLat !== undefined || dto.homeLng !== undefined;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.birthday !== undefined && { birthday: dto.birthday ? new Date(dto.birthday) : null }),
        ...(dto.homeLat !== undefined && { homeLat: dto.homeLat }),
        ...(dto.homeLng !== undefined && { homeLng: dto.homeLng }),
        ...(dto.homeAddress !== undefined && { homeAddress: dto.homeAddress }),
        ...(homeChanged && { homeUpdatedAt: new Date() }),
      },
      select: { id: true, email: true, displayName: true, avatarUrl: true, birthday: true, homeLat: true, homeLng: true, homeAddress: true, homeUpdatedAt: true },
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
