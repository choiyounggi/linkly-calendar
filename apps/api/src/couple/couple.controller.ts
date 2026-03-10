import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { UpdateCoupleDto } from './dto/update-couple.dto';
import { CoupleService } from './couple.service';

@Controller('v1/couples')
export class CoupleController {
  constructor(private readonly coupleService: CoupleService) {}

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
}
