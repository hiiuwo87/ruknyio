'use client';

import { useCallback, useState, memo } from 'react';
import {
  MoreHorizontal,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Package,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product, PRODUCT_STATUS_LABELS, PRODUCT_STATUS_CONFIG } from '@/lib/hooks/useStore';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ProductCardProps {
  product: Product;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onView?: (product: Product) => void;
  onToggleStatus?: (product: Product) => void;
}

const formatPrice = (price: number): string => {
  return price.toLocaleString('en-US');
};

function ProductCardComponent({
  product,
  onEdit,
  onDelete,
  onView,
  onToggleStatus,
}: ProductCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const statusKey = product.isActive ? 'active' : 'draft';
  const statusConfig = PRODUCT_STATUS_CONFIG[statusKey];
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const mainImage = product.images?.[0];

  return (
    <div
      className="bg-white rounded-4xl border border-gray-100 p-3 group cursor-pointer hover:shadow-xl hover:shadow-gray-200/60 hover:border-gray-200 transition-all duration-300"
      onClick={() => onView?.(product)}
    >
      {/* Image Section */}
      <div className="relative aspect-[4/3] rounded-3xl overflow-hidden mb-3">
        {mainImage ? (
          <>
            <img
              src={mainImage}
              alt={product.name}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white shadow-md shadow-gray-200/50 group-hover:scale-110 transition-transform duration-300">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        )}

        {/* Status Badge */}
        <span className={cn(
          "absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold backdrop-blur-md shadow-sm",
          statusConfig.bg,
          statusConfig.color,
        )}>
          {PRODUCT_STATUS_LABELS[statusKey]}
        </span>

        {/* Discount Badge */}
        {hasDiscount && (
          <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/90 backdrop-blur-md text-white shadow-sm">
            خصم
          </span>
        )}

        {/* Stock Badge */}
        {product.stock <= 5 && product.stock > 0 && (
          <span className="absolute bottom-2.5 left-2.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-400/90 backdrop-blur-md text-white shadow-sm">
            متبقي {product.stock}
          </span>
        )}
        {product.stock === 0 && (
          <span className="absolute bottom-2.5 left-2.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-red-500/90 backdrop-blur-md text-white shadow-sm">
            نفذ المخزون
          </span>
        )}

        {/* Actions Menu */}
        <div className="absolute bottom-2.5 right-2.5 z-30">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  "bg-white/90 backdrop-blur-sm shadow-sm",
                  "text-gray-500 hover:text-gray-900 hover:bg-white",
                  "opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100",
                  "transition-all duration-200"
                )}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={4}
              className="min-w-[130px] rounded-xl p-1"
              onClick={(e) => e.stopPropagation()}
            >
              {onEdit && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(product); }}>
                  <Edit2 className="w-3.5 h-3.5" />
                  تحرير
                </DropdownMenuItem>
              )}
              {onToggleStatus && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleStatus(product); }}>
                  {product.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {product.isActive ? 'إخفاء' : 'نشر'}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content Section */}
      <div className="text-right px-1">
        {/* Name */}
        <h3 className="font-bold text-gray-900 text-[14px] leading-tight line-clamp-1 mb-1">
          {product.name}
        </h3>

        {/* Description */}
        <p className="text-[12px] text-gray-400 line-clamp-2 mb-3 leading-relaxed">
          {product.description || 'بدون وصف'}
        </p>

        {/* Price Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              {formatPrice(product.price)} د.ع
            </span>
            {hasDiscount && (
              <span className="text-[11px] text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice!)} د.ع
              </span>
            )}
          </div>

          {/* Stock */}
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <ShoppingCart className="w-3 h-3" />
            {product.stock}
          </span>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {onDelete && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent
            showCloseButton={false}
            onClick={(e) => e.stopPropagation()}
            className="text-center"
          >
            <DialogHeader className="items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <DialogTitle>حذف المنتج</DialogTitle>
              <DialogDescription>
                هل أنت متأكد من حذف - {product.name}
                <br />
                لا يمكن التراجع عن هذا الإجراء
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-row gap-2 sm:justify-center">
              <DialogClose asChild>
                <Button variant="outline" className="flex-1">إلغاء</Button>
              </DialogClose>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteOpen(false);
                  onDelete(product);
                }}
              >
                حذف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-4xl border border-gray-100 p-3 animate-pulse">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl mb-3" />
      <div className="text-right px-1">
        <div className="h-4 bg-gray-200 rounded-md w-3/4 mb-1.5" />
        <div className="space-y-1.5 mb-3">
          <div className="h-3 bg-gray-100 rounded-md w-full" />
          <div className="h-3 bg-gray-100 rounded-md w-2/3" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 bg-gray-200 rounded-md" />
          <div className="h-3 w-8 bg-gray-100 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function ProductsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export const ProductCard = memo(ProductCardComponent);
