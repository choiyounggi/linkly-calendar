import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface OAuthProfile {
  provider: AuthProvider;
  providerUserId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface JwtPayload {
  sub: string; // userId
  provider: AuthProvider;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 소셜 로그인 upsert: 기존 유저면 로그인, 없으면 회원가입
   */
  async validateOrCreateUser(profile: OAuthProfile) {
    let user = await this.prisma.user.findUnique({
      where: {
        authProvider_providerUserId: {
          authProvider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          authProvider: profile.provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        },
      });
    }

    return user;
  }

  /**
   * JWT 발급
   */
  issueToken(userId: string, provider: AuthProvider): string {
    const payload: JwtPayload = { sub: userId, provider };
    return this.jwtService.sign(payload);
  }
}
