import {
  Controller,
  Get,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { UrlMetadataService } from './url-metadata.service';

@ApiTags('Utils')
@Controller('utils')
export class UrlMetadataController {
  constructor(private readonly urlMetadataService: UrlMetadataService) {}

  @Get('url-metadata')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Extract metadata from URL (title, description, image)',
  })
  @ApiQuery({ name: 'url', description: 'The URL to extract metadata from' })
  @ApiResponse({ status: 200, description: 'Metadata extracted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid URL or failed to fetch' })
  async getUrlMetadata(@Query('url') url: string) {
    if (!url) {
      throw new BadRequestException('URL is required');
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    return this.urlMetadataService.extractMetadata(url);
  }
}
