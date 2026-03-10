import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../../core/common/guards/auth/jwt-auth.guard';
import { SocialLinksService } from './social-links.service';
import { UploadService } from '../../../infrastructure/upload/upload.service';
import {
  CreateSocialLinkDto,
  UpdateSocialLinkDto,
  ReorderLinksDto,
  BulkUpdateStatusDto,
  BulkMoveToGroupDto,
  BulkDeleteDto,
} from './dto';

@ApiTags('Social Links')
@Controller('social-links')
export class SocialLinksController {
  constructor(
    private socialLinksService: SocialLinksService,
    private uploadService: UploadService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new social link' })
  @ApiResponse({ status: 201, description: 'Social link created successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  create(@Request() req, @Body() createDto: CreateSocialLinkDto) {
    return this.socialLinksService.create(req.user.id, createDto);
  }

  @Get('my-links')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all my social links' })
  @ApiResponse({
    status: 200,
    description: 'Social links retrieved successfully',
  })
  getMyLinks(@Request() req) {
    return this.socialLinksService.findMyLinks(req.user.id);
  }

  @Get('profile/:profileId')
  @ApiOperation({ summary: 'Get all social links for a profile (public)' })
  @ApiParam({ name: 'profileId', description: 'Profile ID' })
  @ApiResponse({
    status: 200,
    description: 'Social links retrieved successfully',
  })
  getProfileLinks(@Param('profileId') profileId: string) {
    return this.socialLinksService.findByProfile(profileId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single social link' })
  @ApiParam({ name: 'id', description: 'Social link ID' })
  @ApiResponse({
    status: 200,
    description: 'Social link retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Social link not found' })
  findOne(@Param('id') id: string) {
    return this.socialLinksService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a social link' })
  @ApiParam({ name: 'id', description: 'Social link ID' })
  @ApiResponse({ status: 200, description: 'Social link updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Social link not found' })
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateSocialLinkDto,
  ) {
    return this.socialLinksService.update(req.user.id, id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a social link' })
  @ApiParam({ name: 'id', description: 'Social link ID' })
  @ApiResponse({ status: 200, description: 'Social link deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Social link not found' })
  remove(@Request() req, @Param('id') id: string) {
    return this.socialLinksService.remove(req.user.id, id);
  }

  @Post(':id/thumbnail')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB limit for thumbnails
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload thumbnail for a social link' })
  @ApiParam({ name: 'id', description: 'Social link ID' })
  @ApiResponse({ status: 200, description: 'Thumbnail uploaded successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Social link not found' })
  async uploadThumbnail(
    @Request() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Upload the thumbnail using UploadService
    const thumbnailUrl = await this.uploadService.uploadThumbnail(file);

    // Update the social link with the new thumbnail URL
    return this.socialLinksService.update(req.user.id, id, {
      thumbnail: thumbnailUrl,
    });
  }

  @Delete(':id/thumbnail')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete thumbnail from a social link' })
  @ApiParam({ name: 'id', description: 'Social link ID' })
  @ApiResponse({ status: 200, description: 'Thumbnail deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Social link not found' })
  async deleteThumbnail(@Request() req, @Param('id') id: string) {
    // Get current link to find thumbnail URL
    const link = await this.socialLinksService.findOne(id);

    // Delete the thumbnail file if exists
    if (link.thumbnail) {
      await this.uploadService.deleteThumbnail(link.thumbnail);
    }

    // Update the social link to remove thumbnail
    return this.socialLinksService.update(req.user.id, id, { thumbnail: null });
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder social links' })
  @ApiResponse({ status: 200, description: 'Links reordered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid link IDs' })
  reorder(@Request() req, @Body() reorderDto: ReorderLinksDto) {
    return this.socialLinksService.reorder(req.user.id, reorderDto);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get social link statistics' })
  @ApiParam({ name: 'id', description: 'Social link ID' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Social link not found' })
  getStats(@Request() req, @Param('id') id: string) {
    return this.socialLinksService.getLinkStats(req.user.id, id);
  }

  // ============= BULK ACTIONS ENDPOINTS =============

  @Patch('bulk/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk update link status (show/hide)' })
  @ApiResponse({
    status: 200,
    description: 'Links status updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid link IDs' })
  bulkUpdateStatus(@Request() req, @Body() dto: BulkUpdateStatusDto) {
    return this.socialLinksService.bulkUpdateStatus(req.user.id, dto);
  }

  @Patch('bulk/move')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk move links to a group' })
  @ApiResponse({ status: 200, description: 'Links moved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid link IDs or group ID' })
  bulkMoveToGroup(@Request() req, @Body() dto: BulkMoveToGroupDto) {
    return this.socialLinksService.bulkMoveToGroup(req.user.id, dto);
  }

  @Delete('bulk/delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk delete links' })
  @ApiResponse({ status: 200, description: 'Links deleted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid link IDs' })
  bulkDelete(@Request() req, @Body() dto: BulkDeleteDto) {
    return this.socialLinksService.bulkDelete(req.user.id, dto);
  }

  // ============= PUBLIC TRACKING ENDPOINT =============

  @Post(':id/track-click')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track a click on a social link (public endpoint)' })
  @ApiParam({ name: 'id', description: 'Social link ID' })
  @ApiResponse({ status: 200, description: 'Click tracked successfully' })
  @ApiResponse({ status: 404, description: 'Social link not found' })
  trackClick(@Param('id') id: string, @Request() req) {
    const userAgent = req.headers['user-agent'] || '';
    const referer = req.headers['referer'] || req.headers['referrer'] || '';
    const ip = req.ip || req.connection?.remoteAddress || '';

    return this.socialLinksService.trackClick(id, {
      userAgent,
      referer,
      ip,
    });
  }
}
