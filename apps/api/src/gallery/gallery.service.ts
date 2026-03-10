import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { PhotoQueryDto } from './dto/photo-query.dto';

const UPLOAD_DIR = path.resolve(process.cwd(), '../../uploads/photos');
const DEFAULT_PAGE_SIZE = 36;

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);

  constructor(private readonly prisma: PrismaService) {
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async upload(
    coupleId: string,
    userId: string,
    files: Express.Multer.File[],
  ) {
    await this.ensureCoupleMember(coupleId, userId);

    const results = await Promise.all(
      files.map(async (file) => {
        const hash = createHash('sha256').update(file.buffer).digest('hex');
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        const filename = `${hash}${ext}`;
        const filePath = path.join(UPLOAD_DIR, filename);

        if (!existsSync(filePath)) {
          writeFileSync(filePath, file.buffer);
        }

        const url = `/uploads/photos/${filename}`;

        return this.prisma.galleryPhoto.create({
          data: {
            coupleId,
            uploadedByUserId: userId,
            url,
          },
        });
      }),
    );

    return results;
  }

  async findMany(query: PhotoQueryDto & { userId: string }) {
    await this.ensureCoupleMember(query.coupleId, query.userId);

    const take = query.take ?? DEFAULT_PAGE_SIZE;
    const where = { coupleId: query.coupleId };

    if (query.cursor) {
      return this.prisma.galleryPhoto.findMany({
        where,
        take,
        skip: 1,
        cursor: { id: query.cursor },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.galleryPhoto.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(photoId: string, userId: string) {
    const photo = await this.prisma.galleryPhoto.findUnique({
      where: { id: photoId },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    await this.ensureCoupleMember(photo.coupleId, userId);

    // Delete the file on disk
    const filePath = path.join(UPLOAD_DIR, path.basename(photo.url));
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${filePath}`, error);
    }

    await this.prisma.galleryPhoto.delete({ where: { id: photoId } });
  }

  async removeBatch(photoIds: string[], userId: string) {
    if (photoIds.length === 0) return;

    const photos = await this.prisma.galleryPhoto.findMany({
      where: { id: { in: photoIds } },
    });

    if (photos.length === 0) return;

    // Verify membership using the first photo's coupleId
    await this.ensureCoupleMember(photos[0].coupleId, userId);

    // Delete files on disk
    for (const photo of photos) {
      const filePath = path.join(UPLOAD_DIR, path.basename(photo.url));
      try {
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      } catch (error) {
        this.logger.error(`Failed to delete file: ${filePath}`, error);
      }
    }

    await this.prisma.galleryPhoto.deleteMany({
      where: { id: { in: photoIds } },
    });
  }

  private async ensureCoupleMember(coupleId: string, userId: string) {
    const member = await this.prisma.coupleMember.findUnique({
      where: { coupleId_userId: { coupleId, userId } },
      select: { id: true },
    });
    if (!member)
      throw new ForbiddenException('User is not a member of this couple.');
  }
}
