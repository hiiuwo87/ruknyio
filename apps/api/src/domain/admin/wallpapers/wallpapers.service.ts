import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { S3Service } from '../../../shared/services/s3.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WallpapersService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly config: ConfigService,
  ) {
    this.bucket = this.config.get<string>('S3_BUCKET', 'rukny-storage');
  }

  /** List all wallpapers (admin) */
  async findAll() {
    const wallpapers = await this.prisma.wallpaper.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return Promise.all(
      wallpapers.map(async (w) => ({
        ...w,
        fileSize: Number(w.fileSize),
        url: await this.s3.getPresignedGetUrl(this.bucket, w.s3Key, 3600),
      })),
    );
  }

  /** List active wallpapers (public) */
  async findActive() {
    const wallpapers = await this.prisma.wallpaper.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return Promise.all(
      wallpapers.map(async (w) => ({
        id: w.id,
        nameAr: w.nameAr,
        fileType: w.fileType,
        url: await this.s3.getPresignedGetUrl(this.bucket, w.s3Key, 3600),
      })),
    );
  }

  /** Get a fresh presigned URL for a wallpaper by ID */
  async getFileUrl(id: string): Promise<string | null> {
    const wallpaper = await this.prisma.wallpaper.findFirst({
      where: { id, isActive: true },
      select: { s3Key: true },
    });
    if (!wallpaper) return null;
    return this.s3.getPresignedGetUrl(this.bucket, wallpaper.s3Key, 3600);
  }

  /** Upload file to S3 and create DB record in one step */
  async uploadAndCreate(file: Express.Multer.File, nameAr?: string) {
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'bin';
    const key = `wallpapers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const isVideo = file.mimetype.startsWith('video/');

    // Normalize multer buffer to a real Buffer
    const buf = this.toBuffer(file);
    await this.s3.uploadBuffer(this.bucket, key, buf, file.mimetype);

    const maxOrder = await this.prisma.wallpaper.aggregate({
      _max: { sortOrder: true },
    });

    const wallpaper = await this.prisma.wallpaper.create({
      data: {
        nameAr: nameAr || file.originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        s3Key: key,
        fileType: isVideo ? 'video' : 'image',
        mimeType: file.mimetype,
        fileSize: file.size,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    return {
      ...wallpaper,
      fileSize: Number(wallpaper.fileSize),
      url: await this.s3.getPresignedGetUrl(this.bucket, key, 3600),
    };
  }

  /** Update wallpaper */
  async update(id: string, data: { nameAr?: string; isActive?: boolean; sortOrder?: number }) {
    const wallpaper = await this.prisma.wallpaper.findUnique({ where: { id } });
    if (!wallpaper) throw new NotFoundException('Wallpaper not found');

    return this.prisma.wallpaper.update({
      where: { id },
      data,
    });
  }

  /** Delete wallpaper (remove from S3 + DB) */
  async delete(id: string) {
    const wallpaper = await this.prisma.wallpaper.findUnique({ where: { id } });
    if (!wallpaper) throw new NotFoundException('Wallpaper not found');

    await this.s3.deleteObject(this.bucket, wallpaper.s3Key);
    await this.prisma.wallpaper.delete({ where: { id } });

    return { deleted: true };
  }

  /** Normalize multer file buffer to a real Node Buffer */
  private toBuffer(file: Express.Multer.File): Buffer {
    const fb = (file as any).buffer;
    if (Buffer.isBuffer(fb)) return fb;
    if (fb instanceof Uint8Array) return Buffer.from(fb);
    if (Array.isArray(fb?.data)) return Buffer.from(fb.data);
    if (fb && typeof fb === 'object') {
      const keys = Object.keys(fb).filter((k) => /^\d+$/.test(k));
      if (keys.length > 0) {
        const arr = new Uint8Array(keys.length);
        keys.sort((a, b) => Number(a) - Number(b));
        for (let i = 0; i < keys.length; i++) arr[i] = Number(fb[keys[i]]) || 0;
        return Buffer.from(arr);
      }
    }
    throw new BadRequestException('Could not read uploaded file buffer');
  }
}
