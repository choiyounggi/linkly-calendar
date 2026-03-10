import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PhotoQueryDto } from './dto/photo-query.dto';
import { GalleryService } from './gallery.service';

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
    @Body('userId') userId: string,
  ) {
    return this.galleryService.upload(coupleId, userId, files);
  }

  @Get()
  async findMany(@Query() query: PhotoQueryDto) {
    return this.galleryService.findMany(query);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    await this.galleryService.remove(id, userId);
  }

  @Delete()
  async removeBatch(
    @Body('ids') ids: string[],
    @Body('userId') userId: string,
  ) {
    await this.galleryService.removeBatch(ids, userId);
  }
}
