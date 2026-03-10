import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * JWT 인증 후 req.user에서 현재 사용자를 추출하는 데코레이터
 * @example
 * @Get('me')
 * @UseGuards(JwtAuthGuard)
 * async getMe(@CurrentUser() user: { id: string }) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
