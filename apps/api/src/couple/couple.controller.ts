import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateCoupleDto } from './dto/update-couple.dto';
import { SendInviteDto } from './dto/send-invite.dto';
import { CoupleService } from './couple.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/couples')
export class CoupleController {
  constructor(private readonly coupleService: CoupleService) {}

  /* ── 초대 ── */

  @Post('invites')
  async sendInvite(
    @CurrentUser('id') userId: string,
    @Body() body: Omit<SendInviteDto, 'userId'>,
  ) {
    return this.coupleService.sendInvite({ ...body, userId } as SendInviteDto);
  }

  @Get('invites/sent')
  async getSentInvite(@CurrentUser('id') userId: string) {
    return this.coupleService.getSentInvite(userId);
  }

  @Get('invites/received')
  async getReceivedInvites(@CurrentUser('id') userId: string) {
    return this.coupleService.getReceivedInvites(userId);
  }

  @Post('invites/:id/accept')
  async acceptInvite(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.coupleService.acceptInvite(id, userId);
  }

  @Post('invites/:id/decline')
  async declineInvite(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.coupleService.declineInvite(id, userId);
  }

  @Delete('invites/sent')
  async cancelInvite(@CurrentUser('id') userId: string) {
    await this.coupleService.cancelInvite(userId);
  }

  /* ── 커플 정보 ── */

  @Get(':id')
  async findCoupleInfo(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.coupleService.findCoupleInfo(id, userId);
  }

  @Patch(':id')
  async updateCouple(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: UpdateCoupleDto,
  ) {
    return this.coupleService.updateCouple(id, userId, body);
  }

  @Delete(':id')
  async breakUp(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.coupleService.breakUp(id, userId);
  }
}
