import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CoupleRouteService } from './couple-route.service';
import { CoupleRouteDto } from './dto/couple-route.dto';
import { DeparturesComputeDto } from './dto/departures-compute.dto';
import { PoiSearchDto } from './dto/poi-search.dto';
import { RouteComputeDto } from './dto/route-compute.dto';
import { TransitService } from './transit.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/transit')
export class TransitController {
  constructor(
    private readonly transitService: TransitService,
    private readonly coupleRouteService: CoupleRouteService,
  ) {}

  @Get('poi/search')
  async searchPoi(@Query() query: PoiSearchDto) {
    return this.transitService.searchPoi(query.keyword, query.page);
  }

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

  @Post('couple-route')
  async coupleRoute(@CurrentUser('id') userId: string, @Body() body: CoupleRouteDto) {
    return this.coupleRouteService.analyze(body.eventId, userId, body.forceRefresh ?? false);
  }
}
