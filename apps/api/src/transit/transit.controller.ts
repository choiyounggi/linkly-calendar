import { Body, Controller, Post } from '@nestjs/common';
import { TransitService } from './transit.service';

@Controller('v1/transit')
export class TransitController {
  constructor(private readonly transitService: TransitService) {}

  @Post('route:compute')
  async computeRoute(@Body() body: Record<string, unknown>): Promise<unknown> {
    return this.transitService.computeRoute(body);
  }

  @Post('departures:compute')
  async computeDepartures(
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    return this.transitService.computeDepartures(body);
  }
}
