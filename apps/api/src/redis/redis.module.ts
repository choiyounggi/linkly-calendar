import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConfig } from './redis.config';

const redisProvider = {
  provide: 'REDIS_CLIENT',
  useFactory: () =>
    new Redis({
      ...redisConfig(),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableAutoPipelining: true,
    }),
};

@Module({
  providers: [redisProvider],
  exports: [redisProvider],
})
export class RedisModule {}
