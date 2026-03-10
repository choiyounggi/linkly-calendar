import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UpdateCoupleDto } from './dto/update-couple.dto';
import { SendInviteDto } from './dto/send-invite.dto';
import { CoupleService } from './couple.service';

@Controller('v1/couples')
export class CoupleController {
  constructor(private readonly coupleService: CoupleService) {}

  /* ── 커플 정보 ── */

  @Get(':id')
  async findCoupleInfo(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    return this.coupleService.findCoupleInfo(id, userId);
  }

  @Patch(':id')
  async updateCouple(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() body: UpdateCoupleDto,
  ) {
    return this.coupleService.updateCouple(id, userId, body);
  }

  @Delete(':id')
  async breakUp(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    await this.coupleService.breakUp(id, userId);
  }

  /* ── 초대 ── */

  @Post('invites')
  async sendInvite(@Body() body: SendInviteDto) {
    return this.coupleService.sendInvite(body);
  }

  @Get('invites/sent')
  async getSentInvite(@Query('userId') userId: string) {
    return this.coupleService.getSentInvite(userId);
  }

  @Get('invites/received')
  async getReceivedInvites(@Query('userId') userId: string) {
    return this.coupleService.getReceivedInvites(userId);
  }

  @Post('invites/:id/accept')
  async acceptInvite(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    return this.coupleService.acceptInvite(id, userId);
  }

  @Post('invites/:id/decline')
  async declineInvite(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    await this.coupleService.declineInvite(id, userId);
  }

  @Delete('invites/sent')
  async cancelInvite(@Query('userId') userId: string) {
    await this.coupleService.cancelInvite(userId);
  }
}
