import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { WallpapersService } from './wallpapers.service';

@Controller('wallpapers')
@SkipThrottle()
export class PublicWallpapersController {
  constructor(private readonly wallpapersService: WallpapersService) {}

  @Get()
  findActive() {
    return this.wallpapersService.findActive();
  }

  @Get(':id/file')
  async getFile(@Param('id') id: string, @Res() res: Response) {
    const url = await this.wallpapersService.getFileUrl(id);
    if (!url) throw new NotFoundException();
    res.redirect(url);
  }
}
