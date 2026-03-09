import { Module, OnModuleDestroy, Inject } from '@nestjs/common';
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
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      // Redis 연결이 이미 닫혀있을 수 있음
    }
  }
}
