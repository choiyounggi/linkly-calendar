import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { TransitController } from './transit.controller';
import { TransitService } from './transit.service';

@Module({
  imports: [RedisModule],
  controllers: [TransitController],
  providers: [TransitService],
})
export class TransitModule {}
