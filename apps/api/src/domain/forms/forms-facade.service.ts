import { Injectable } from '@nestjs/common';
import { FormsCommandsService } from './services/forms-commands.service';
import { FormsQueriesService } from './services/forms-queries.service';
import { FormsSubmissionService } from './services/forms-submission.service';
import { FormsExportService } from './services/forms-export.service';
import { FormsStepsService } from './services/forms-steps.service';
import { CreateFormDto, UpdateFormDto, SubmitFormDto, FormStatus } from './dto';

/**
 * 🎭 Forms Facade Service
 *
 * Thin orchestration layer that delegates to specialized services.
 * Maintains backward compatibility with existing controller.
 *
 * ~100 lines - follows facade pattern
 */
@Injectable()
export class FormsFacadeService {
  constructor(
    private readonly commands: FormsCommandsService,
    private readonly queries: FormsQueriesService,
    private readonly submissions: FormsSubmissionService,
    private readonly exports: FormsExportService,
    private readonly steps: FormsStepsService,
  ) {}

  // ============ Commands ============

  create(userId: string, dto: CreateFormDto) {
    return this.commands.create(userId, dto);
  }

  update(userId: string, formId: string, dto: UpdateFormDto) {
    return this.commands.update(userId, formId, dto);
  }

  updateStatus(userId: string, formId: string, status: FormStatus) {
    return this.commands.updateStatus(userId, formId, status);
  }

  delete(userId: string, formId: string) {
    return this.commands.delete(userId, formId);
  }

  duplicateForm(userId: string, formId: string) {
    return this.commands.duplicate(userId, formId);
  }

  // ============ Queries ============

  findAll(filters?: {
    userId?: string;
    type?: string;
    status?: string;
    linkedEventId?: string;
    linkedStoreId?: string;
    page?: number;
    limit?: number;
  }) {
    return this.queries.findAll(filters);
  }

  findById(formId: string, userId?: string) {
    return this.queries.findById(formId, userId);
  }

  findBySlug(slug: string) {
    return this.queries.findBySlug(slug);
  }

  findPublicByUsername(username: string, limit?: number) {
    return this.queries.findPublicByUsername(username, limit);
  }

  // ============ Steps ============

  getFormSteps(userId: string, formId: string) {
    return this.steps.getFormSteps(userId, formId);
  }

  updateFormSteps(userId: string, formId: string, steps: any[]) {
    return this.steps.updateFormSteps(userId, formId, steps);
  }

  // ============ Submissions ============

  submitForm(formId: string, dto: SubmitFormDto, userId?: string) {
    return this.submissions.submitForm(formId, dto, userId);
  }

  getFormSubmissions(
    userId: string,
    formId: string,
    options?: { cursor?: string; limit?: number; search?: string },
  ) {
    return this.submissions.getSubmissions(userId, formId, options);
  }

  deleteSubmission(userId: string, formId: string, submissionId: string) {
    return this.submissions.deleteSubmission(userId, formId, submissionId);
  }

  // ============ Export & Analytics ============

  exportSubmissions(userId: string, formId: string) {
    return this.exports.exportSubmissions(userId, formId);
  }

  getFormAnalytics(userId: string, formId: string) {
    return this.exports.getFormAnalytics(userId, formId);
  }
}
