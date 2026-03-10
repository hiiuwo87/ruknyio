import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ShareService } from './share.service';
import { JwtAuthGuard } from '../../../core/common/guards/auth/jwt-auth.guard';
import { CustomQRDto, TrackShareDto, QRCodeFormat } from './dto';

@ApiTags('Share & QR Codes')
@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get('profile/:username/qr')
  @ApiOperation({ summary: 'Generate QR code for profile' })
  @ApiQuery({ name: 'format', required: false, enum: QRCodeFormat })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Returns QR code data' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getProfileQR(
    @Param('username') username: string,
    @Query('format', new DefaultValuePipe(QRCodeFormat.PNG))
    format: QRCodeFormat,
    @Query('size', new DefaultValuePipe(300)) size: number,
  ) {
    return this.shareService.generateProfileQR(username, format, size);
  }

  @Get('profile/:username/share-links')
  @ApiOperation({ summary: 'Get share links for all social platforms' })
  @ApiResponse({
    status: 200,
    description: 'Returns share links for all platforms',
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getProfileShareLinks(@Param('username') username: string) {
    return this.shareService.getProfileShareLinks(username);
  }

  @Get('social-link/:linkId/qr')
  @ApiOperation({ summary: 'Generate QR code for social link' })
  @ApiQuery({ name: 'format', required: false, enum: QRCodeFormat })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Returns QR code data' })
  @ApiResponse({ status: 404, description: 'Social link not found' })
  async getSocialLinkQR(
    @Param('linkId') linkId: string,
    @Query('format', new DefaultValuePipe(QRCodeFormat.PNG))
    format: QRCodeFormat,
    @Query('size', new DefaultValuePipe(300)) size: number,
  ) {
    return this.shareService.generateSocialLinkQR(linkId, format, size);
  }

  @Post('custom-qr')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate custom QR code for any URL' })
  @ApiResponse({ status: 201, description: 'QR code generated successfully' })
  async generateCustomQR(@Body() customQRDto: CustomQRDto) {
    return this.shareService.generateCustomQR(customQRDto);
  }

  @Post('track-share')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Track share action for analytics' })
  @ApiResponse({ status: 201, description: 'Share tracked successfully' })
  @ApiResponse({ status: 404, description: 'Profile or social link not found' })
  async trackShare(@Body() trackShareDto: TrackShareDto) {
    return this.shareService.trackShare(trackShareDto);
  }

  @Get('stats/:profileId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get share statistics for profile' })
  @ApiResponse({ status: 200, description: 'Returns share statistics' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getShareStats(@Param('profileId') profileId: string) {
    return this.shareService.getShareStats(profileId);
  }
}
