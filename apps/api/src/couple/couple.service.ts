import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCoupleDto } from './dto/update-couple.dto';

@Injectable()
export class CoupleService {
  private readonly logger = new Logger(CoupleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findCoupleInfo(coupleId: string, userId: string) {
    await this.ensureCoupleMember(coupleId, userId);

    const couple = await this.prisma.couple.findUnique({
      where: { id: coupleId },
      select: {
        id: true,
        status: true,
        anniversaryDate: true,
        createdAt: true,
        members: {
          select: {
            id: true,
            userId: true,
            nickname: true,
            role: true,
            user: {
              select: {
                id: true,
                displayName: true,
                birthday: true,
                homeAddress: true,
              },
            },
          },
        },
      },
    });

    if (!couple) throw new NotFoundException('Couple not found');

    const members = couple.members.map((m) => ({
      memberId: m.id,
      userId: m.userId,
      nickname: m.nickname ?? m.user.displayName,
      displayName: m.user.displayName,
      birthday: m.user.birthday,
      homeAddress: m.user.homeAddress,
      role: m.role,
      isMe: m.userId === userId,
    }));

    return {
      id: couple.id,
      status: couple.status,
      anniversaryDate: couple.anniversaryDate,
      createdAt: couple.createdAt,
      members,
    };
  }

  async updateCouple(coupleId: string, userId: string, dto: UpdateCoupleDto) {
    const members = await this.prisma.coupleMember.findMany({
      where: { coupleId },
      select: { id: true, userId: true },
    });

    const me = members.find((m) => m.userId === userId);
    if (!me) throw new ForbiddenException('User is not a member of this couple.');

    const partner = members.find((m) => m.userId !== userId);

    // Update couple anniversary
    if (dto.anniversaryDate !== undefined) {
      await this.prisma.couple.update({
        where: { id: coupleId },
        data: {
          anniversaryDate: dto.anniversaryDate ? new Date(dto.anniversaryDate) : null,
        },
      });
    }

    // Update my nickname
    if (dto.myNickname !== undefined) {
      await this.prisma.coupleMember.update({
        where: { id: me.id },
        data: { nickname: dto.myNickname || null },
      });
    }

    // Update partner's nickname
    if (dto.partnerNickname !== undefined && partner) {
      await this.prisma.coupleMember.update({
        where: { id: partner.id },
        data: { nickname: dto.partnerNickname || null },
      });
    }

    return this.findCoupleInfo(coupleId, userId);
  }

  async breakUp(coupleId: string, userId: string) {
    await this.ensureCoupleMember(coupleId, userId);

    // Couple has onDelete: Cascade on all related models
    // (CoupleMember, CoupleInvite, CalendarEvent, GalleryPhoto, ChatMessage)
    // So deleting the couple cascades everything.
    await this.prisma.couple.delete({ where: { id: coupleId } });

    this.logger.log(`Couple ${coupleId} broken up by user ${userId}`);
  }

  private async ensureCoupleMember(coupleId: string, userId: string) {
    const member = await this.prisma.coupleMember.findUnique({
      where: { coupleId_userId: { coupleId, userId } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('User is not a member of this couple.');
  }
}
