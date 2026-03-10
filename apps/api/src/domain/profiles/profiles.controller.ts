import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto, UpdateProfileDto } from './dto';
import { StorageService } from '../storage/storage.service';

@ApiTags('Profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(
    private profilesService: ProfilesService,
    private storageService: StorageService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create user profile' })
  @ApiResponse({ status: 201, description: 'Profile created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({
    status: 409,
    description: 'Username already taken or profile already exists',
  })
  create(@Request() req, @Body() createProfileDto: CreateProfileDto) {
    return this.profilesService.create(req.user.id, createProfileDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getMyProfile(@Request() req) {
    return this.profilesService.findByUserId(req.user.id);
  }

  @Get('check/:username')
  @ApiOperation({ summary: 'Check if username is available' })
  @ApiParam({ name: 'username', description: 'Username to check availability' })
  @ApiResponse({ status: 200, description: 'Username availability checked' })
  checkUsername(@Param('username') username: string) {
    return this.profilesService.checkUsernameAvailability(username);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get profile by username (public)' })
  @ApiParam({ name: 'username', description: 'Username of the profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  findOne(@Param('username') username: string, @Request() req) {
    const requesterId = req.user?.id;
    return this.profilesService.findByUsername(username, requesterId);
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  update(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.profilesService.update(req.user.id, updateProfileDto);
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile avatar to S3' })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async uploadAvatar(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Use StorageService to upload to S3 with organized paths
    const key = await this.storageService.uploadAvatar(req.user.id, file);
    const profile = await this.profilesService.uploadAvatar(req.user.id, key);

    // Return profile with presigned URL
    const avatarUrl = await this.storageService.getPresignedUrl(key);
    return { ...profile, avatarUrl };
  }

  @Post('cover')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload cover image to S3' })
  @ApiResponse({
    status: 200,
    description: 'Cover image uploaded successfully',
  })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async uploadCover(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Use StorageService to upload to S3 with organized paths
    const key = await this.storageService.uploadCover(req.user.id, file);
    const profile = await this.profilesService.uploadCover(req.user.id, key);

    // Return profile with presigned URL
    const coverUrl = await this.storageService.getPresignedUrl(key);
    return { ...profile, coverUrl };
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user profile' })
  @ApiResponse({ status: 200, description: 'Profile deleted successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  remove(@Request() req) {
    return this.profilesService.remove(req.user.id);
  }
}
