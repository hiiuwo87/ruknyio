import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EventsService } from './events-facade.service';
import { CreateEventDto, EventStatus } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RegisterEventDto } from './dto/register-event.dto';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  create(@Request() req, @Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(req.user.id, createEventDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all events (Public)' })
  @ApiQuery({ name: 'status', enum: EventStatus, required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'eventType', required: false })
  @ApiQuery({ name: 'isFeatured', type: Boolean, required: false })
  @ApiQuery({ name: 'isVirtual', type: Boolean, required: false })
  @ApiQuery({ name: 'upcoming', type: Boolean, required: false })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  findAll(
    @Query('status') status?: EventStatus,
    @Query('categoryId') categoryId?: string,
    @Query('eventType') eventType?: string,
    @Query('isFeatured') isFeatured?: boolean,
    @Query('isVirtual') isVirtual?: boolean,
    @Query('upcoming') upcoming?: boolean,
  ) {
    return this.eventsService.findAll({
      status,
      categoryId,
      eventType,
      isFeatured,
      isVirtual,
      upcoming,
    });
  }

  @Get('my-registrations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my event registrations' })
  @ApiResponse({
    status: 200,
    description: 'Registrations retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyRegistrations(@Request() req) {
    return this.eventsService.getMyRegistrations(req.user.id);
  }

  @Get('my-events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my created events' })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyEvents(@Request() req) {
    return this.eventsService.getMyEvents(req.user.id);
  }

  @Get('e/:slug')
  @ApiOperation({ summary: 'Get event by short slug (Share URL)' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  findByShortSlug(@Param('slug') slug: string, @Request() req) {
    const userId = req.user?.id;
    return this.eventsService.findBySlug(slug, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID (Public)' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  findOne(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id;
    return this.eventsService.findOne(id, userId);
  }

  @Get(':id/registrations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all registrations for an event (Event owner only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Registrations retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not event owner' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  getEventRegistrations(@Param('id') id: string, @Request() req) {
    return this.eventsService.getEventRegistrations(id, req.user.id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get event by slug (Public - Short URL)' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  findBySlug(@Param('slug') slug: string, @Request() req) {
    const userId = req.user?.id;
    return this.eventsService.findBySlug(slug, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an event' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, req.user.id, updateEventDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an event' })
  @ApiResponse({ status: 204, description: 'Event deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  remove(@Param('id') id: string, @Request() req) {
    return this.eventsService.remove(id, req.user.id);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 registrations per minute
  @ApiOperation({ summary: 'Register for an event' })
  @ApiResponse({ status: 201, description: 'Registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  register(@Request() req, @Body() registerEventDto: RegisterEventDto) {
    return this.eventsService.register(req.user.id, registerEventDto);
  }

  @Post(':eventId/cancel-registration')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel event registration' })
  @ApiResponse({
    status: 200,
    description: 'Registration cancelled successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  cancelRegistration(@Param('eventId') eventId: string, @Request() req) {
    return this.eventsService.cancelRegistration(req.user.id, eventId);
  }
}
