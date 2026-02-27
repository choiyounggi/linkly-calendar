import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import net from 'node:net';

const DEFAULT_TIMEOUT_MS = 1000;

const checkTcp = (host: string, port: number, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port });

    const cleanup = () => {
      socket.removeAllListeners();
      socket.end();
      socket.destroy();
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      cleanup();
      resolve(true);
    });

    socket.once('error', () => {
      clearTimeout(timer);
      cleanup();
      resolve(false);
    });
  });

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    const postgresHost = process.env.POSTGRES_HOST ?? 'localhost';
    const postgresPort = Number.parseInt(
      process.env.POSTGRES_PORT ?? '5432',
      10,
    );
    const redisHost = process.env.REDIS_HOST ?? 'localhost';
    const redisPort = Number.parseInt(process.env.REDIS_PORT ?? '6379', 10);

    const [postgresOk, redisOk] = await Promise.all([
      checkTcp(postgresHost, postgresPort),
      checkTcp(redisHost, redisPort),
    ]);

    const postgres = postgresOk ? 'ok' : 'fail';
    const redis = redisOk ? 'ok' : 'fail';

    return {
      ok: postgresOk && redisOk,
      postgres,
      redis,
      ts: new Date().toISOString(),
    };
  }
}
