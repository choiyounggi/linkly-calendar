import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@Controller('v1/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser('id') userId: string) {
    return this.userService.findMe(userId);
  }

  @Get('me/status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentUser('id') userId: string) {
    return this.userService.getStatus(userId);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchByEmail(@Query('email') email: string) {
    const user = await this.userService.findByEmail(email);
    return { found: Boolean(user), user };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser('id') userId: string, @Body() body: UpdateUserDto) {
    return this.userService.updateMe(userId, body);
  }
}
