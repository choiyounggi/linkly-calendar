import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CoupleController } from './couple.controller';
import { CoupleService } from './couple.service';

@Module({
  imports: [PrismaModule],
  controllers: [CoupleController],
  providers: [CoupleService],
})
export class CoupleModule {}
