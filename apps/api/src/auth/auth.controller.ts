import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('v1/auth')
export class AuthController {
  private readonly frontendUrl: string;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  /* ── Kakao ── */

  @Get('kakao')
  @UseGuards(AuthGuard('kakao'))
  kakaoLogin() {
    // Passport redirects to Kakao
  }

  @Get('kakao/callback')
  @UseGuards(AuthGuard('kakao'))
  kakaoCallback(@Req() req: Request, @Res() res: Response) {
    return this.handleCallback(req, res);
  }

  /* ── Google ── */

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.handleCallback(req, res);
  }

  /* ── Naver ── */

  @Get('naver')
  @UseGuards(AuthGuard('naver'))
  naverLogin() {
    // Passport redirects to Naver
  }

  @Get('naver/callback')
  @UseGuards(AuthGuard('naver'))
  naverCallback(@Req() req: Request, @Res() res: Response) {
    return this.handleCallback(req, res);
  }

  /* ── 공통 콜백 처리 ── */

  private handleCallback(req: Request, res: Response) {
    const user = req.user as { id: string; authProvider: string };
    const token = this.authService.issueToken(user.id, user.authProvider as any);
    const redirectUrl = `${this.frontendUrl}/auth/callback?token=${token}`;
    return res.redirect(redirectUrl);
  }
}
