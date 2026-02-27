import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { TransitController } from './transit.controller';
import { TransitService } from './transit.service';

const redisProvider = {
  provide: 'REDIS_CLIENT',
  useFactory: () => {
    const host = process.env.REDIS_HOST ?? 'localhost';
    const port = Number.parseInt(process.env.REDIS_PORT ?? '6379', 10);
    const db = Number.parseInt(process.env.REDIS_DB ?? '0', 10);
    const password = process.env.REDIS_PASSWORD;

    return new Redis({
      host,
      port,
      db,
      password,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableAutoPipelining: true,
    });
  },
};

@Module({
  controllers: [TransitController],
  providers: [TransitService, redisProvider],
})
export class TransitModule {}
