import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-naver-v2';
import { AuthProvider } from '@prisma/client';
import { AuthService, type OAuthProfile } from '../auth.service';

@Injectable()
export class NaverStrategy extends PassportStrategy(Strategy, 'naver') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('NAVER_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('NAVER_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('NAVER_CALLBACK_URL'),
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (error: any, user?: any) => void,
  ) {
    const oauthProfile: OAuthProfile = {
      provider: AuthProvider.NAVER,
      providerUserId: profile.id,
      email: profile.email ?? null,
      displayName: profile.nickname ?? profile.name ?? 'Naver User',
      avatarUrl: profile.profileImage ?? null,
    };

    const user = await this.authService.validateOrCreateUser(oauthProfile);
    done(null, user);
  }
}
