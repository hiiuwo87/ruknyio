import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Cart Repository - Data Access Layer
 */
@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly cartItemInclude = {
    products: {
      include: {
        product_images: {
          where: { isPrimary: true },
          take: 1,
        },
        stores: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    },
  } satisfies Prisma.cart_itemsInclude;

  // ==================== CART ====================

  async findByUserId(userId: string) {
    return this.prisma.carts.findUnique({
      where: { userId },
    });
  }

  async create(userId: string) {
    return this.prisma.carts.create({
      data: {
        id: uuidv4(),
        userId,
        updatedAt: new Date(),
      },
    });
  }

  async findWithItems(cartId: string) {
    return this.prisma.carts.findUnique({
      where: { id: cartId },
      include: {
        cart_items: {
          include: this.cartItemInclude,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  // ==================== CART ITEMS ====================

  async findCartItem(cartId: string, productId: string, variantId?: string) {
    return this.prisma.cart_items.findFirst({
      where: {
        cartId,
        productId,
        ...(variantId && { variantId }),
      },
    });
  }

  async createCartItem(data: {
    cartId: string;
    productId: string;
    quantity: number;
    variantId?: string;
  }) {
    return this.prisma.cart_items.create({
      data: {
        id: uuidv4(),
        ...data,
        updatedAt: new Date(),
      },
      include: this.cartItemInclude,
    });
  }

  async updateCartItemQuantity(id: string, quantity: number) {
    return this.prisma.cart_items.update({
      where: { id },
      data: { quantity, updatedAt: new Date() },
      include: this.cartItemInclude,
    });
  }

  async deleteCartItem(id: string) {
    return this.prisma.cart_items.delete({
      where: { id },
    });
  }

  async clearCart(cartId: string) {
    return this.prisma.cart_items.deleteMany({
      where: { cartId },
    });
  }

  async countCartItems(cartId: string) {
    return this.prisma.cart_items.count({
      where: { cartId },
    });
  }
}
