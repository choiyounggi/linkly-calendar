import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({
  imports: [PrismaModule],
  controllers: [GalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
