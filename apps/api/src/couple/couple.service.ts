import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';
import { CoupleStatus, CoupleMemberRole, InviteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCoupleDto } from './dto/update-couple.dto';
import { SendInviteDto } from './dto/send-invite.dto';

const UPLOAD_DIR = path.resolve(process.cwd(), '../../uploads/photos');

@Injectable()
export class CoupleService {
  private readonly logger = new Logger(CoupleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /* ── 커플 정보 ── */

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

    if (dto.anniversaryDate !== undefined) {
      await this.prisma.couple.update({
        where: { id: coupleId },
        data: {
          anniversaryDate: dto.anniversaryDate ? new Date(dto.anniversaryDate) : null,
        },
      });
    }

    if (dto.myNickname !== undefined) {
      await this.prisma.coupleMember.update({
        where: { id: me.id },
        data: { nickname: dto.myNickname || null },
      });
    }

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

    // Delete gallery photo files from disk before cascade delete
    const photos = await this.prisma.galleryPhoto.findMany({
      where: { coupleId },
      select: { url: true },
    });
    for (const photo of photos) {
      const filePath = path.join(UPLOAD_DIR, path.basename(photo.url));
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch (error) {
        this.logger.error(`Failed to delete file: ${filePath}`, error);
      }
    }

    await this.prisma.couple.delete({ where: { id: coupleId } });
    this.logger.log(`Couple ${coupleId} broken up by user ${userId}`);
  }

  /* ── 초대 ── */

  /**
   * 커플 신청 보내기
   * - 자기 자신에게 보낼 수 없음
   * - 이미 커플이면 보낼 수 없음
   * - 상대가 이미 커플이면 보낼 수 없음
   * - 기존 PENDING 초대가 있으면 자동 취소 후 새로 생성 (1개만 유지)
   * - 같은 상대에게 다시 보내면 기존 것 취소 후 새로 생성 (중복 row 방지)
   */
  async sendInvite(dto: SendInviteDto) {
    const inviter = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true },
    });
    if (!inviter) throw new NotFoundException('User not found');

    // 자기 자신 체크
    const invitee = await this.prisma.user.findUnique({
      where: { email: dto.inviteeEmail },
      select: { id: true, email: true, displayName: true },
    });
    if (!invitee) throw new NotFoundException('해당 이메일의 사용자를 찾을 수 없습니다.');
    if (invitee.id === inviter.id) throw new BadRequestException('자기 자신에게는 신청할 수 없습니다.');

    // 내가 이미 커플인지
    const myMembership = await this.prisma.coupleMember.findUnique({
      where: { userId: inviter.id },
      select: { id: true },
    });
    if (myMembership) throw new BadRequestException('이미 커플이 등록되어 있습니다.');

    // 상대가 이미 커플인지
    const theirMembership = await this.prisma.coupleMember.findUnique({
      where: { userId: invitee.id },
      select: { id: true },
    });
    if (theirMembership) throw new BadRequestException('상대방은 이미 커플이 등록되어 있습니다.');

    // 기존 PENDING 초대 전부 취소 (다른 사람/같은 사람 모두)
    await this.prisma.coupleInvite.updateMany({
      where: { inviterUserId: inviter.id, status: InviteStatus.PENDING },
      data: { status: InviteStatus.CANCELED },
    });

    // 새 초대 생성 (임시 Couple도 함께)
    const couple = await this.prisma.couple.create({
      data: { status: CoupleStatus.PENDING },
    });

    const code = randomBytes(6).toString('hex');
    const invite = await this.prisma.coupleInvite.create({
      data: {
        coupleId: couple.id,
        inviterUserId: inviter.id,
        inviteeEmail: invitee.email,
        inviteeUserId: invitee.id,
        code,
        status: InviteStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일
      },
      include: {
        invitee: { select: { id: true, displayName: true, email: true } },
      },
    });

    return invite;
  }

  /** 내가 보낸 PENDING 초대 조회 */
  async getSentInvite(userId: string) {
    return this.prisma.coupleInvite.findFirst({
      where: { inviterUserId: userId, status: InviteStatus.PENDING },
      include: {
        invitee: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 내가 받은 PENDING 초대 목록 */
  async getReceivedInvites(userId: string) {
    return this.prisma.coupleInvite.findMany({
      where: { inviteeUserId: userId, status: InviteStatus.PENDING },
      include: {
        inviter: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 초대 수락 */
  async acceptInvite(inviteId: string, userId: string) {
    const invite = await this.prisma.coupleInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.inviteeUserId !== userId) throw new ForbiddenException('권한이 없습니다.');
    if (invite.status !== InviteStatus.PENDING) throw new BadRequestException('이미 처리된 초대입니다.');

    // 수락하는 사람이 이미 커플이면 불가
    const myMembership = await this.prisma.coupleMember.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (myMembership) throw new BadRequestException('이미 커플이 등록되어 있습니다.');

    // 신청자도 이미 커플이면 불가 (다른 경로로 커플 생성된 경우)
    const inviterMembership = await this.prisma.coupleMember.findUnique({
      where: { userId: invite.inviterUserId },
      select: { id: true },
    });
    if (inviterMembership) throw new BadRequestException('신청자가 이미 다른 커플에 등록되어 있습니다.');

    // 트랜잭션으로 처리
    await this.prisma.$transaction(async (tx) => {
      // 초대 수락 처리
      await tx.coupleInvite.update({
        where: { id: inviteId },
        data: { status: InviteStatus.ACCEPTED, respondedAt: new Date() },
      });

      // Couple 활성화 + 멤버 등록
      await tx.couple.update({
        where: { id: invite.coupleId },
        data: { status: CoupleStatus.ACTIVE },
      });

      await tx.coupleMember.createMany({
        data: [
          { coupleId: invite.coupleId, userId: invite.inviterUserId, role: CoupleMemberRole.OWNER },
          { coupleId: invite.coupleId, userId, role: CoupleMemberRole.MEMBER },
        ],
      });

      // 양쪽의 다른 PENDING 초대 전부 취소
      await tx.coupleInvite.updateMany({
        where: {
          id: { not: inviteId },
          status: InviteStatus.PENDING,
          OR: [
            { inviterUserId: invite.inviterUserId },
            { inviterUserId: userId },
            { inviteeUserId: invite.inviterUserId },
            { inviteeUserId: userId },
          ],
        },
        data: { status: InviteStatus.CANCELED },
      });
    });

    return { coupleId: invite.coupleId };
  }

  /** 초대 거절 */
  async declineInvite(inviteId: string, userId: string) {
    const invite = await this.prisma.coupleInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.inviteeUserId !== userId) throw new ForbiddenException('권한이 없습니다.');
    if (invite.status !== InviteStatus.PENDING) throw new BadRequestException('이미 처리된 초대입니다.');

    await this.prisma.coupleInvite.update({
      where: { id: inviteId },
      data: { status: InviteStatus.DECLINED, respondedAt: new Date() },
    });

    // PENDING 상태의 Couple 정리
    await this.prisma.couple.delete({ where: { id: invite.coupleId } }).catch(() => {});
  }

  /** 내가 보낸 초대 취소 */
  async cancelInvite(userId: string) {
    const invite = await this.prisma.coupleInvite.findFirst({
      where: { inviterUserId: userId, status: InviteStatus.PENDING },
    });
    if (!invite) return;

    await this.prisma.coupleInvite.update({
      where: { id: invite.id },
      data: { status: InviteStatus.CANCELED },
    });

    await this.prisma.couple.delete({ where: { id: invite.coupleId } }).catch(() => {});
  }

  private async ensureCoupleMember(coupleId: string, userId: string) {
    const member = await this.prisma.coupleMember.findUnique({
      where: { coupleId_userId: { coupleId, userId } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('User is not a member of this couple.');
  }
}
