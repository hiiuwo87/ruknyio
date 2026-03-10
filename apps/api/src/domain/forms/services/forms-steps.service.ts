import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { SecureIds } from '../../../core/common/utils/secure-id.util';

/**
 * 🔧 Forms Steps Service
 * Handles: getFormSteps, updateFormSteps
 *
 * ~150 lines - focused service for multi-step form management
 */
@Injectable()
export class FormsStepsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get form steps with fields
   */
  async getFormSteps(userId: string, formId: string) {
    const form = await this.prisma.form.findUnique({ where: { id: formId } });

    if (!form) throw new NotFoundException('Form not found');
    if (form.userId !== userId) throw new ForbiddenException('Not authorized');

    return this.prisma.form_steps.findMany({
      where: { formId },
      orderBy: { order: 'asc' },
      include: { form_fields: { orderBy: { order: 'asc' } } },
    });
  }

  /**
   * Update form steps (full replacement)
   */
  async updateFormSteps(userId: string, formId: string, steps: any[]) {
    const form = await this.prisma.form.findUnique({ where: { id: formId } });

    if (!form) throw new NotFoundException('Form not found');
    if (form.userId !== userId) throw new ForbiddenException('Not authorized');

    return this.prisma.$transaction(async (tx) => {
      // Delete existing steps and fields
      await tx.form_steps.deleteMany({ where: { formId } });
      await tx.formField.deleteMany({ where: { formId } });

      // Update multi-step flag
      await tx.form.update({
        where: { id: formId },
        data: { isMultiStep: steps.length > 0 },
      });

      // Create new steps and fields
      for (const step of steps) {
        const stepId = SecureIds.generic();

        await tx.form_steps.create({
          data: {
            id: stepId,
            formId,
            title: step.title,
            description: step.description,
            order: step.order,
            updatedAt: new Date(),
          },
        });

        if (step.fields?.length) {
          await tx.formField.createMany({
            data: step.fields.map((field: any) => this.formFieldRow(field, formId, stepId)),
          });
        }
      }

      return tx.form_steps.findMany({
        where: { formId },
        orderBy: { order: 'asc' },
        include: { form_fields: { orderBy: { order: 'asc' } } },
      });
    });
  }

  /** ⚡ Performance: صف واحد لـ createMany (تجنب N+1) */
  private formFieldRow(field: any, formId: string, stepId: string) {
    return {
      id: SecureIds.field(),
      formId,
      stepId,
      label: field.label,
      description: field.description ?? null,
      type: field.type,
      order: field.order,
      required: field.required ?? false,
      placeholder: field.placeholder ?? null,
      options: field.options ?? null,
      minValue: field.minValue ?? null,
      maxValue: field.maxValue ?? null,
      allowedFileTypes: field.allowedFileTypes || [],
      maxFileSize: field.maxFileSize ?? null,
      maxFiles: field.maxFiles ?? null,
    } as any;
  }
}
