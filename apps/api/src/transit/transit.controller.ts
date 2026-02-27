import { Body, Controller, Post } from '@nestjs/common';
import { DeparturesComputeDto } from './dto/departures-compute.dto';
import { RouteComputeDto } from './dto/route-compute.dto';
import { TransitService } from './transit.service';

@Controller('v1/transit')
export class TransitController {
  constructor(private readonly transitService: TransitService) {}

  @Post('route:compute')
  async computeRoute(@Body() body: RouteComputeDto): Promise<unknown> {
    return this.transitService.computeRoute(body);
  }

  @Post('departures:compute')
  async computeDepartures(
    @Body() body: DeparturesComputeDto,
  ): Promise<unknown> {
    return this.transitService.computeDepartures(body);
  }
}
