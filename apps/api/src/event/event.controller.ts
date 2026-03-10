import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventService } from './event.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  async create(@CurrentUser('id') userId: string, @Body() body: CreateEventDto) {
    return this.eventService.create({ ...body, createdByUserId: userId });
  }

  @Get()
  async findByMonth(@CurrentUser('id') userId: string, @Query() query: EventQueryDto) {
    return this.eventService.findByMonth({ ...query, userId });
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.eventService.findById(id, userId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() body: UpdateEventDto) {
    return this.eventService.update(id, userId, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.eventService.remove(id, userId);
  }
}
