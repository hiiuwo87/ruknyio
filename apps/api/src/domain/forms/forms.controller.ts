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
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { FormsService } from './forms.service';
import { CreateFormDto, UpdateFormDto, SubmitFormDto, FormStatus } from './dto';
import { JwtAuthGuard } from '../../core/common/guards/auth/jwt-auth.guard';
import { OptionalUserId } from '../../core/common/decorators/auth/optional-user.decorator';

@ApiTags('Forms')
@Controller('forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
  ) {}

  // ==================== PUBLIC ENDPOINTS ====================

  @Get('public/user/:username')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get published forms by username (public)' })
  @ApiResponse({ status: 200, description: 'Forms retrieved successfully' })
  async getPublicFormsByUsername(
    @Param('username') username: string,
    @Query('limit') limit?: number,
  ) {
    return this.formsService.findPublicByUsername(username, limit || 10);
  }

  @Get('public/:slug')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get form by slug (public)' })
  @ApiResponse({ status: 200, description: 'Form retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async getPublicForm(@Param('slug') slug: string) {
    return this.formsService.findBySlug(slug);
  }

  @Post('public/:slug/submit')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 submissions per minute per IP
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit form (public)' })
  @ApiResponse({ status: 201, description: 'Form submitted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async submitPublicForm(
    @Param('slug') slug: string,
    @Body() submitFormDto: SubmitFormDto,
    @OptionalUserId() userId?: string,
  ) {
    const form = await this.formsService.findBySlug(slug);
    return this.formsService.submitForm(form.id, submitFormDto, userId);
  }

  // ==================== AUTHENTICATED ENDPOINTS ====================

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new form' })
  @ApiResponse({ status: 201, description: 'Form created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  async create(@Request() req, @Body() createFormDto: CreateFormDto) {
    return this.formsService.create(req.user.id, createFormDto);
  }

  @Get()
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all forms for current user' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'linkedEventId', required: false })
  @ApiQuery({ name: 'linkedStoreId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Forms retrieved successfully' })
  async getUserForms(
    @Request() req,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('linkedEventId') linkedEventId?: string,
    @Query('linkedStoreId') linkedStoreId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.formsService.findAll({
      userId: req.user.id,
      type,
      status,
      linkedEventId,
      linkedStoreId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get form by ID' })
  @ApiResponse({ status: 200, description: 'Form retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async getForm(@Request() req, @Param('id') id: string) {
    return this.formsService.findById(id, req.user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update form' })
  @ApiResponse({ status: 200, description: 'Form updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateFormDto: UpdateFormDto,
  ) {
    return this.formsService.update(req.user.id, id, updateFormDto);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update form status' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async updateStatus(
    @Request() req,
    @Param('id') id: string,
    @Body('status') status: FormStatus,
  ) {
    return this.formsService.updateStatus(req.user.id, id, status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete form' })
  @ApiResponse({ status: 204, description: 'Form deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async delete(@Request() req, @Param('id') id: string) {
    await this.formsService.delete(req.user.id, id);
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duplicate form' })
  @ApiResponse({ status: 201, description: 'Form duplicated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async duplicate(@Request() req, @Param('id') id: string) {
    return this.formsService.duplicateForm(req.user.id, id);
  }

  // ==================== SUBMISSIONS ====================

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit form (authenticated)' })
  @ApiResponse({ status: 201, description: 'Form submitted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async submitForm(
    @Request() req,
    @Param('id') id: string,
    @Body() submitFormDto: SubmitFormDto,
  ) {
    return this.formsService.submitForm(id, submitFormDto, req.user.id);
  }

  @Get(':id/submissions')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get form submissions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Submissions retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async getSubmissions(
    @Request() req,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.formsService.getFormSubmissions(
      req.user.id,
      id,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Delete(':id/submissions/:submissionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a submission' })
  @ApiResponse({ status: 204, description: 'Submission deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async deleteSubmission(
    @Request() req,
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
  ) {
    await this.formsService.deleteSubmission(req.user.id, id, submissionId);
  }

  // ==================== STEPS ====================

  @Get(':id/steps')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get form steps' })
  @ApiResponse({ status: 200, description: 'Steps retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async getFormSteps(@Request() req, @Param('id') id: string) {
    return this.formsService.getFormSteps(req.user.id, id);
  }

  @Put(':id/steps')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update form steps' })
  @ApiResponse({ status: 200, description: 'Steps updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async updateFormSteps(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { steps: any[] },
  ) {
    return this.formsService.updateFormSteps(req.user.id, id, body.steps);
  }

  // ==================== ANALYTICS ====================

  @Get(':id/analytics')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get form analytics' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async getAnalytics(@Request() req, @Param('id') id: string) {
    return this.formsService.getFormAnalytics(req.user.id, id);
  }

  @Get(':id/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export form submissions as CSV' })
  @ApiResponse({ status: 200, description: 'CSV file generated successfully' })
  @ApiResponse({ status: 400, description: 'No submissions to export' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async exportSubmissions(
    @Request() req,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.formsService.exportSubmissions(req.user.id, id);

    // Add BOM for UTF-8 Excel compatibility
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + result.content;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(csvWithBOM);
  }
}
