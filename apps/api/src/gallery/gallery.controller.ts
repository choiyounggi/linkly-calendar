import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PhotoQueryDto } from './dto/photo-query.dto';
import { GalleryService } from './gallery.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/photos')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
    }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('coupleId') coupleId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.galleryService.upload(coupleId, userId, files);
  }

  @Get()
  async findMany(@CurrentUser('id') userId: string, @Query() query: PhotoQueryDto) {
    return this.galleryService.findMany({ ...query, userId });
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.galleryService.remove(id, userId);
  }

  @Delete()
  async removeBatch(
    @Body('ids') ids: string[],
    @CurrentUser('id') userId: string,
  ) {
    await this.galleryService.removeBatch(ids, userId);
  }
}
