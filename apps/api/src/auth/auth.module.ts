import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { KakaoStrategy } from './strategies/kakao.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { NaverStrategy } from './strategies/naver.strategy';

/** Register OAuth strategies only when their client IDs are configured. */
function buildOAuthProviders(): any[] {
  const providers: any[] = [];
  if (process.env.KAKAO_CLIENT_ID) providers.push(KakaoStrategy);
  if (process.env.GOOGLE_CLIENT_ID) providers.push(GoogleStrategy);
  if (process.env.NAVER_CLIENT_ID) providers.push(NaverStrategy);
  return providers;
}

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ...buildOAuthProviders()],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
