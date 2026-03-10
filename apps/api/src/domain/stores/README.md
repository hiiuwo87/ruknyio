# Stores Domain Module

## 📁 New Architecture

This module has been refactored to follow a **modular architecture** with **Repository Pattern** for better maintainability, testability, and scalability.

```
stores/
├── index.ts                    # Barrel exports
├── stores.module.ts            # Main module (aggregates sub-modules)
├── README.md                   # This file
│
├── store/                      # 🏪 Store Management
│   ├── store.module.ts
│   ├── store.controller.ts
│   ├── store.service.ts
│   ├── store.repository.ts     # Data Access Layer
│   ├── index.ts
│   └── dto/
│       ├── create-store.dto.ts
│       └── update-store.dto.ts
│
├── products/                   # 📦 Products Management
│   ├── products.module.ts
│   ├── products.controller.ts
│   ├── products.service.ts
│   ├── products.repository.ts
│   ├── products-upload.service.ts
│   ├── index.ts
│   ├── dto/
│   ├── variants/               # Product Variants (sizes, colors)
│   │   ├── variants.module.ts
│   │   ├── variants.repository.ts
│   │   └── index.ts
│   └── attributes/             # Product Attributes (warranty, brand)
│       ├── attributes.module.ts
│       ├── attributes.repository.ts
│       └── index.ts
│
├── cart/                       # 🛒 Shopping Cart
│   ├── cart.module.ts
│   ├── cart.controller.ts
│   ├── cart.service.ts
│   ├── cart.repository.ts
│   └── index.ts
│
├── orders/                     # 📋 Orders Management
│   ├── orders.module.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   ├── orders.repository.ts
│   └── index.ts
│
├── reviews/                    # ⭐ Product Reviews
│   ├── reviews.module.ts
│   ├── reviews.controller.ts
│   ├── reviews.service.ts
│   ├── reviews.repository.ts
│   └── index.ts
│
├── wishlists/                  # ❤️ User Wishlists
│   ├── wishlists.module.ts
│   ├── wishlists.controller.ts
│   ├── wishlists.service.ts
│   ├── wishlists.repository.ts
│   └── index.ts
│
├── coupons/                    # 🎟️ Discount Coupons
│   ├── coupons.module.ts
│   ├── coupons.controller.ts
│   ├── coupons.service.ts
│   ├── coupons.repository.ts
│   └── index.ts
│
├── addresses/                  # 📍 Delivery Addresses
│   ├── addresses.module.ts
│   ├── addresses.controller.ts
│   ├── addresses.service.ts
│   ├── addresses.repository.ts
│   └── index.ts
│
└── dto/                        # Legacy DTOs (shared)
    ├── create-product.dto.ts
    ├── update-product.dto.ts
    └── ...
```

## 🏗️ Architecture Pattern

Each sub-module follows a **3-layer architecture**:

```
┌─────────────────────────────────────┐
│           Controller                │  ← HTTP Layer (Routes, Validation)
├─────────────────────────────────────┤
│            Service                  │  ← Business Logic Layer
├─────────────────────────────────────┤
│           Repository                │  ← Data Access Layer (Prisma)
└─────────────────────────────────────┘
```

### Benefits

1. **Separation of Concerns**: Each layer has a single responsibility
2. **Testability**: Easy to mock repositories for unit testing
3. **Maintainability**: Changes in one layer don't affect others
4. **Scalability**: Easy to add new features without affecting existing code

## 📖 Usage Examples

### Importing Services

```typescript
// Import from barrel export
import { StoreService, ProductsService } from '../domain/stores';

// Or import from specific module
import { StoreService } from '../domain/stores/store';
```

### Using Repository Pattern

```typescript
@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly storeRepository: StoreRepository,
  ) {}

  async create(userId: string, dto: CreateProductDto) {
    // Get store using repository
    const store = await this.storeRepository.findByUserId(userId);
    
    // Create product using repository
    return this.productsRepository.create({
      ...dto,
      storeId: store.id,
    });
  }
}
```

## 🔄 Migration Guide

The legacy files are still active for backward compatibility. To migrate:

1. **Phase 1** (Current): New structure created with repositories
2. **Phase 2**: Gradually move logic from legacy services to new services
3. **Phase 3**: Update imports across the codebase
4. **Phase 4**: Remove legacy files

### Files to Migrate

| Legacy File | New Location |
|------------|--------------|
| `stores.service.ts` | `store/store.service.ts` |
| `stores.controller.ts` | `store/store.controller.ts` |
| `products.service.ts` | `products/products.service.ts` |
| `cart.service.ts` | `cart/cart.service.ts` |
| `orders.service.ts` | `orders/orders.service.ts` |
| `reviews.service.ts` | `reviews/reviews.service.ts` |
| `wishlists.service.ts` | `wishlists/wishlists.service.ts` |
| `coupons.service.ts` | `coupons/coupons.service.ts` |
| `addresses.service.ts` | `addresses/addresses.service.ts` |

## 🧪 Testing

Each repository can be easily mocked:

```typescript
describe('ProductsService', () => {
  let service: ProductsService;
  let repository: jest.Mocked<ProductsRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: ProductsRepository,
          useValue: {
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ProductsService);
    repository = module.get(ProductsRepository);
  });

  it('should find product by id', async () => {
    repository.findById.mockResolvedValue({ id: '1', name: 'Test' });
    
    const result = await service.findOne('1');
    
    expect(repository.findById).toHaveBeenCalledWith('1');
    expect(result.name).toBe('Test');
  });
});
```

## 📝 Notes

- All repositories use Prisma for database operations
- Caching is handled at the service level using CacheManager
- DTOs are validated using class-validator
- All IDs use UUID format
