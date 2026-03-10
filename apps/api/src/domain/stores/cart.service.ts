import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get or create user's cart
   */
  private async getOrCreateCart(userId: string) {
    let cart = await this.prisma.carts.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.carts.create({
        data: {
          id: uuidv4(),
          userId,
          updatedAt: new Date(),
        },
      });
    }

    return cart;
  }

  /**
   * Get user's cart with items and product details
   */
  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    const cartWithItems = await this.prisma.carts.findUnique({
      where: { id: cart.id },
      include: {
        cart_items: {
          include: {
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
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Calculate totals
    const items = cartWithItems?.cart_items || [];
    const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => {
      const price = Number(item.products.salePrice || item.products.price);
      return sum + price * item.quantity;
    }, 0);

    // Group items by store
    const itemsByStore = items.reduce(
      (acc, item) => {
        const storeId = item.products.storeId;
        if (!acc[storeId]) {
          acc[storeId] = {
            store: item.products.stores,
            items: [],
            subtotal: 0,
          };
        }
        const price = Number(item.products.salePrice || item.products.price);
        acc[storeId].items.push(item);
        acc[storeId].subtotal += price * item.quantity;
        return acc;
      },
      {} as Record<string, any>,
    );

    return {
      id: cart.id,
      itemsCount,
      subtotal,
      currency: items[0]?.products.currency || 'IQD',
      stores: Object.values(itemsByStore),
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        product: {
          id: item.products.id,
          name: item.products.name,
          nameAr: item.products.nameAr,
          slug: item.products.slug,
          price: Number(item.products.price),
          salePrice: item.products.salePrice
            ? Number(item.products.salePrice)
            : null,
          currency: item.products.currency,
          quantity: item.products.quantity, // Available stock
          status: item.products.status,
          image: item.products.product_images[0]?.imagePath || null,
          store: item.products.stores,
        },
        subtotal:
          Number(item.products.salePrice || item.products.price) *
          item.quantity,
        createdAt: item.createdAt,
      })),
    };
  }

  /**
   * Add product to cart
   */
  async addToCart(userId: string, addToCartDto: AddToCartDto) {
    const { productId, quantity = 1 } = addToCartDto;

    // Check if product exists and is active
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('المنتج غير موجود');
    }

    if (product.status !== 'ACTIVE') {
      throw new BadRequestException('المنتج غير متاح حالياً');
    }

    if (product.quantity < quantity) {
      throw new BadRequestException(
        `الكمية المتاحة هي ${product.quantity} فقط`,
      );
    }

    // Get or create cart
    const cart = await this.getOrCreateCart(userId);

    // Check if product already in cart
    const existingItem = await this.prisma.cart_items.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;

      if (newQuantity > product.quantity) {
        throw new BadRequestException(
          `الكمية المتاحة هي ${product.quantity} فقط`,
        );
      }

      await this.prisma.cart_items.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          updatedAt: new Date(),
        },
      });
    } else {
      // Add new item
      await this.prisma.cart_items.create({
        data: {
          id: uuidv4(),
          cartId: cart.id,
          productId,
          quantity,
          updatedAt: new Date(),
        },
      });
    }

    // Update cart timestamp
    await this.prisma.carts.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    return this.getCart(userId);
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(
    userId: string,
    productId: string,
    updateDto: UpdateCartItemDto,
  ) {
    const { quantity } = updateDto;

    // Get user's cart
    const cart = await this.prisma.carts.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new NotFoundException('السلة غير موجودة');
    }

    // Find the cart item
    const cartItem = await this.prisma.cart_items.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      include: { products: true },
    });

    if (!cartItem) {
      throw new NotFoundException('المنتج غير موجود في السلة');
    }

    // Check stock
    if (quantity > cartItem.products.quantity) {
      throw new BadRequestException(
        `الكمية المتاحة هي ${cartItem.products.quantity} فقط`,
      );
    }

    // Update quantity
    await this.prisma.cart_items.update({
      where: { id: cartItem.id },
      data: {
        quantity,
        updatedAt: new Date(),
      },
    });

    // Update cart timestamp
    await this.prisma.carts.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    return this.getCart(userId);
  }

  /**
   * Remove product from cart
   */
  async removeFromCart(userId: string, productId: string) {
    // Get user's cart
    const cart = await this.prisma.carts.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new NotFoundException('السلة غير موجودة');
    }

    // Find and delete the cart item
    const cartItem = await this.prisma.cart_items.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    if (!cartItem) {
      throw new NotFoundException('المنتج غير موجود في السلة');
    }

    await this.prisma.cart_items.delete({
      where: { id: cartItem.id },
    });

    // Update cart timestamp
    await this.prisma.carts.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    return this.getCart(userId);
  }

  /**
   * Clear all items from cart
   */
  async clearCart(userId: string) {
    const cart = await this.prisma.carts.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new NotFoundException('السلة غير موجودة');
    }

    await this.prisma.cart_items.deleteMany({
      where: { cartId: cart.id },
    });

    // Update cart timestamp
    await this.prisma.carts.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() },
    });

    return { message: 'تم تفريغ السلة بنجاح', itemsCount: 0, subtotal: 0 };
  }

  /**
   * Get cart items count (for header badge)
   */
  async getCartCount(userId: string) {
    const cart = await this.prisma.carts.findUnique({
      where: { userId },
      include: {
        cart_items: {
          select: { quantity: true },
        },
      },
    });

    if (!cart) {
      return { count: 0 };
    }

    const count = cart.cart_items.reduce((sum, item) => sum + item.quantity, 0);
    return { count };
  }

  /**
   * Validate cart before checkout
   * Checks stock availability and product status
   */
  async validateCart(userId: string) {
    const cart = await this.getCart(userId);
    const errors: { productId: string; productName: string; error: string }[] =
      [];
    const validItems: typeof cart.items = [];

    for (const item of cart.items) {
      if (item.product.status !== 'ACTIVE') {
        errors.push({
          productId: item.productId,
          productName: item.product.nameAr || item.product.name,
          error: 'المنتج غير متاح حالياً',
        });
      } else if (item.product.quantity < item.quantity) {
        errors.push({
          productId: item.productId,
          productName: item.product.nameAr || item.product.name,
          error: `الكمية المتاحة هي ${item.product.quantity} فقط`,
        });
      } else {
        validItems.push(item);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      validItems,
      itemsCount: validItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: validItems.reduce((sum, item) => sum + item.subtotal, 0),
    };
  }
}
