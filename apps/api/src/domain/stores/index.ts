/**
 * Stores Domain - Main Exports
 *
 * This file provides barrel exports for the stores domain module.
 * Import from this file instead of individual sub-modules for cleaner imports.
 *
 * @example
 * import { StoresService, ProductsService, CartService } from './domain/stores';
 */

// Main module
export * from './stores.module';

// Sub-modules with repositories
export * from './cart';
export * from './orders';
export * from './reviews';
export * from './wishlists';
export * from './coupons';
export * from './addresses';
export * from './products';

// Services
export * from './stores.service';
export * from './products.service';
export * from './cart.service';
export * from './orders.service';
export * from './reviews.service';
export * from './wishlists.service';
export * from './coupons.service';
export * from './addresses.service';
export * from './product-variants.service';
export * from './product-attributes.service';
export * from './product-categories.service';

// Controllers
export * from './stores.controller';
export * from './products.controller';
export * from './cart.controller';
export * from './orders.controller';
export * from './reviews.controller';
export * from './wishlists.controller';
export * from './coupons.controller';
export * from './addresses.controller';
export * from './product-variants.controller';
export * from './product-attributes.controller';
export * from './product-categories.controller';

// DTOs
export * from './dto/create-store.dto';
export * from './dto/update-store.dto';
export * from './dto/create-product.dto';
export * from './dto/update-product.dto';
export * from './dto/cart.dto';
export * from './dto/order.dto';
export * from './dto/review.dto';
export * from './dto/wishlist.dto';
export * from './dto/coupon.dto';
export * from './dto/address.dto';
export * from './dto/product-variant.dto';
export * from './dto/product-attribute.dto';
export * from './dto/product-category.dto';
