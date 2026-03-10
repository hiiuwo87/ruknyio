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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/common/guards/auth/jwt-auth.guard';
import { LinkGroupsService } from './link-groups.service';
import { CreateLinkGroupDto, UpdateLinkGroupDto } from './dto';

@ApiTags('Link Groups')
@Controller('link-groups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LinkGroupsController {
  constructor(private linkGroupsService: LinkGroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new link group' })
  @ApiResponse({ status: 201, description: 'Link group created successfully' })
  create(@Request() req, @Body() createDto: CreateLinkGroupDto) {
    return this.linkGroupsService.create(req.user.id, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all my link groups' })
  @ApiResponse({
    status: 200,
    description: 'Link groups retrieved successfully',
  })
  findAll(@Request() req) {
    return this.linkGroupsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single link group' })
  @ApiParam({ name: 'id', description: 'Link group ID' })
  @ApiResponse({
    status: 200,
    description: 'Link group retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Link group not found' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.linkGroupsService.findOne(req.user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a link group' })
  @ApiParam({ name: 'id', description: 'Link group ID' })
  @ApiResponse({ status: 200, description: 'Link group updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Link group not found' })
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateLinkGroupDto,
  ) {
    return this.linkGroupsService.update(req.user.id, id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a link group' })
  @ApiParam({ name: 'id', description: 'Link group ID' })
  @ApiResponse({ status: 200, description: 'Link group deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Link group not found' })
  remove(@Request() req, @Param('id') id: string) {
    return this.linkGroupsService.remove(req.user.id, id);
  }
}
