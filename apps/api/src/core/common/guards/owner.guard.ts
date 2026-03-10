import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Reflector } from '@nestjs/core';

/**
 * 🔒 Owner Guard - التحقق من ملكية الموارد
 *
 * يستخدم مع decorator @CheckOwnership لتحديد نوع المورد و field الـ userId
 *
 * مثال:
 * @CheckOwnership('event', 'userId')
 * @UseGuards(JwtAuthGuard, OwnerGuard)
 */
export const OWNERSHIP_KEY = 'ownership';
export const CheckOwnership = (
  resourceType: string,
  userIdField: string = 'userId',
) => SetMetadata(OWNERSHIP_KEY, { resourceType, userIdField });

@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ownership = this.reflector.get<{
      resourceType: string;
      userIdField: string;
    }>(OWNERSHIP_KEY, context.getHandler());

    // إذا لم يتم تحديد ownership check، السماح بالمرور
    if (!ownership) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // الحصول على resource ID من params أو body
    const resourceId =
      request.params.id || request.params[`${ownership.resourceType}Id`];

    if (!resourceId) {
      // إذا لم يكن هناك resource ID، قد يكون create operation - السماح
      return true;
    }

    // البحث عن المورد والتحقق من الملكية
    const resource = await this.checkOwnership(
      ownership.resourceType,
      resourceId,
      user.id,
      ownership.userIdField,
    );

    if (!resource) {
      throw new NotFoundException(`${ownership.resourceType} not found`);
    }

    return true;
  }

  /**
   * 🔒 التحقق من ملكية المورد
   */
  private async checkOwnership(
    resourceType: string,
    resourceId: string,
    userId: string,
    userIdField: string,
  ): Promise<any> {
    try {
      // الحصول على model name (lowercase + singular)
      const modelName = this.getModelName(resourceType);

      // استخدام Prisma client بشكل ديناميكي
      const resource = await (this.prisma as any)[modelName]
        .findUnique({
          where: { id: resourceId },
          select: {
            id: true,
            [userIdField]: true,
          },
        })
        .catch(() => null);

      if (!resource) {
        return null;
      }

      // التحقق من الملكية
      const resourceUserId = resource[userIdField];
      if (resourceUserId !== userId) {
        throw new ForbiddenException(
          `You do not have permission to access this ${resourceType}`,
        );
      }

      return resource;
    } catch (error) {
      // إذا كان ForbiddenException، أعد رميها
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // لأي خطأ آخر، نرمي NotFoundException (لإخفاء وجود/عدم وجود المورد)
      throw new NotFoundException(`${resourceType} not found`);
    }
  }

  /**
   * تحويل resource type إلى Prisma model name
   */
  private getModelName(resourceType: string): string {
    // تحويل إلى lowercase وإزالة 's' في النهاية إذا كان موجوداً
    const singular = resourceType.toLowerCase().replace(/s$/, '');

    // قائمة بـ models المعروفة
    const modelMap: Record<string, string> = {
      event: 'event',
      events: 'event',
      form: 'form',
      forms: 'form',
      store: 'store',
      stores: 'store',
      product: 'product',
      products: 'product',
      profile: 'profile',
      profiles: 'profile',
      user: 'user',
      users: 'user',
    };

    return modelMap[singular] || singular;
  }
}
