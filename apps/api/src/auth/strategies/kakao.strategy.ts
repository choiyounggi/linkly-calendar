import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import { AuthProvider } from '@prisma/client';
import { AuthService, type OAuthProfile } from '../auth.service';

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('KAKAO_CLIENT_ID'),
      clientSecret: configService.get<string>('KAKAO_CLIENT_SECRET', ''),
      callbackURL: configService.getOrThrow<string>('KAKAO_CALLBACK_URL'),
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (error: any, user?: any) => void,
  ) {
    const oauthProfile: OAuthProfile = {
      provider: AuthProvider.KAKAO,
      providerUserId: String(profile.id),
      email: profile._json?.kakao_account?.email ?? null,
      displayName: profile.displayName ?? profile._json?.properties?.nickname ?? 'Kakao User',
      avatarUrl: profile._json?.properties?.profile_image ?? null,
    };

    const user = await this.authService.validateOrCreateUser(oauthProfile);
    done(null, user);
  }
}
