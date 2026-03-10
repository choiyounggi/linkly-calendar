import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventService } from './event.service';

@Controller('v1/events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  async create(@Body() body: CreateEventDto) {
    return this.eventService.create(body);
  }

  @Get()
  async findByMonth(@Query() query: EventQueryDto) {
    return this.eventService.findByMonth(query);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Query('userId') userId: string) {
    return this.eventService.findById(id, userId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Query('userId') userId: string, @Body() body: UpdateEventDto) {
    return this.eventService.update(id, userId, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Query('userId') userId: string) {
    await this.eventService.remove(id, userId);
  }
}
