import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@Controller('v1/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@Query('userId') userId: string) {
    return this.userService.findMe(userId);
  }

  @Patch('me')
  async updateMe(@Query('userId') userId: string, @Body() body: UpdateUserDto) {
    return this.userService.updateMe(userId, body);
  }
}
