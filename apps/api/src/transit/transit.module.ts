import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { CoupleRouteService } from './couple-route.service';
import { TransitController } from './transit.controller';
import { TransitService } from './transit.service';

@Module({
  imports: [RedisModule, PrismaModule],
  controllers: [TransitController],
  providers: [TransitService, CoupleRouteService],
})
export class TransitModule {}
