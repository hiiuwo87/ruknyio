'use client';

import { useCallback, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { 
  MoreHorizontal,
  Edit2, 
  Trash2, 
  Eye,
  Copy,
  ExternalLink,
  MessageSquare,
  Globe,
  Lock,
  FileText,
  Link2,
  Star,
  ClipboardList,
  UserPlus,
  ShoppingBag,
  HelpCircle,
  MessageCircle,
  FormInput,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Form, 
  FormStatus,
  FormType,
  FORM_STATUS_LABELS,
  FORM_STATUS_CONFIG,
  FORM_TYPE_LABELS
} from '@/lib/hooks/useForms';
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

interface FormCardProps {
  form: Form;
  onEdit?: (form: Form) => void;
  onDelete?: (form: Form) => void;
  onView?: (form: Form) => void;
  onDuplicate?: (form: Form) => void;
  onViewResponses?: (form: Form) => void;
  variant?: 'grid' | 'list';
}

// أيقونات وألوان حسب نوع النموذج
const FORM_TYPE_STYLES: Record<FormType, { icon: React.ElementType; color: string; bg: string }> = {
  [FormType.CONTACT]: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-500' },
  [FormType.SURVEY]: { icon: ClipboardList, color: 'text-violet-500', bg: 'bg-violet-500' },
  [FormType.REGISTRATION]: { icon: UserPlus, color: 'text-emerald-500', bg: 'bg-emerald-500' },
  [FormType.ORDER]: { icon: ShoppingBag, color: 'text-orange-500', bg: 'bg-orange-500' },
  [FormType.FEEDBACK]: { icon: Star, color: 'text-amber-500', bg: 'bg-amber-500' },
  [FormType.QUIZ]: { icon: HelpCircle, color: 'text-pink-500', bg: 'bg-pink-500' },
  [FormType.APPLICATION]: { icon: FormInput, color: 'text-indigo-500', bg: 'bg-indigo-500' },
  [FormType.OTHER]: { icon: FileText, color: 'text-gray-500', bg: 'bg-gray-500' },
};

export function FormCardComponent({ 
  form, 
  onEdit, 
  onDelete, 
  onView,
  onDuplicate,
  onViewResponses,
  variant = 'grid'
}: FormCardProps) {
  const statusConfig = FORM_STATUS_CONFIG[form.status];
  const typeStyle = FORM_TYPE_STYLES[form.type] || FORM_TYPE_STYLES[FormType.OTHER];
  const TypeIcon = typeStyle.icon;
  const submissionsCount = form._count?.submissions || form.submissionCount || 0;
  const fieldsCount = form._count?.fields || form.fields?.length || 0;

  const copyFormLink = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const link = `${window.location.origin}/f/${form.slug}`;
    navigator.clipboard.writeText(link);
    toast.success('تم نسخ الرابط');
  }, [form.slug]);

  const openFormPage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/f/${form.slug}`, '_blank');
  }, [form.slug]);

  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-4xl border border-gray-100 p-3 group cursor-pointer hover:shadow-xl hover:shadow-gray-200/60 hover:border-gray-200 transition-all duration-300"
      onClick={() => onView?.(form)}
    >
      {/* Image/Icon Section */}
      <div className="relative aspect-[4/3] rounded-3xl overflow-hidden mb-3">
        {/* Cover Image or Icon */}
        {form.coverImage ? (
          <>
            <img 
              src={form.coverImage} 
              alt={form.title}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
            />
            {/* Overlay gradient for better badge readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />
          </>
        ) : (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center",
            "bg-gradient-to-br from-gray-50 via-white to-gray-100"
          )}>
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center",
              "bg-white shadow-md shadow-gray-200/50",
              "group-hover:scale-110 transition-transform duration-300"
            )}>
              <TypeIcon className={cn("w-8 h-8", typeStyle.color)} />
            </div>
          </div>
        )}

        {/* Status Badge - Top Right */}
        <span className={cn(
          "absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold",
          "backdrop-blur-md shadow-sm",
          statusConfig.bg,
          statusConfig.color
        )}>
          {FORM_STATUS_LABELS[form.status]}
        </span>

        {/* Responses Badge - Top Left (if has responses) */}
        {submissionsCount > 0 && (
          <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-500/90 backdrop-blur-md text-white flex items-center gap-1 shadow-sm">
            <MessageSquare className="w-3 h-3" />
            {submissionsCount}
          </span>
        )}

        {/* Privacy Badge - Bottom Left */}
        <span className={cn(
          "absolute bottom-2.5 left-2.5 w-7 h-7 rounded-lg flex items-center justify-center shadow-sm",
          form.requiresAuthentication 
            ? "bg-amber-400/90 backdrop-blur-md" 
            : "bg-emerald-400/90 backdrop-blur-md"
        )}>
          {form.requiresAuthentication ? (
            <Lock className="w-3.5 h-3.5 text-white" />
          ) : (
            <Globe className="w-3.5 h-3.5 text-white" />
          )}
        </span>

        {/* Actions Menu - Bottom Right */}
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
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(form); }}>
                  <Edit2 className="w-3.5 h-3.5" />
                  تحرير
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={copyFormLink}>
                <Link2 className="w-3.5 h-3.5" />
                نسخ الرابط
              </DropdownMenuItem>
              {form.status === FormStatus.PUBLISHED && (
                <DropdownMenuItem onClick={openFormPage}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  فتح النموذج
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(form); }}>
                  <Copy className="w-3.5 h-3.5" />
                  نسخ
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
        {/* Name & Type Row */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <h3 className="font-bold text-gray-900 text-[14px] leading-tight line-clamp-1 flex-1 min-w-0">
            {form.title}
          </h3>
          <span className={cn(
            "px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap border",
            typeStyle.color,
            `${typeStyle.bg}/10`,
            `border-current/15`
          )}>
            {FORM_TYPE_LABELS[form.type]}
          </span>
        </div>

        {/* Description */}
        <p className="text-[12px] text-gray-400 line-clamp-2 mb-3 leading-relaxed">
          {form.description || 'بدون وصف'}
        </p>

        {/* Stats Row */}
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          {/* Responses */}
          <span className={cn(
            "flex items-center gap-1",
            submissionsCount > 0 && "text-violet-500 font-medium"
          )}>
            <MessageSquare className="w-3 h-3" />
            {submissionsCount}
          </span>

          <span className="w-px h-3 bg-gray-200" />

          {/* Views */}
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {form.viewCount || 0}
          </span>

          <span className="w-px h-3 bg-gray-200" />

          {/* Fields */}
          <span className="flex items-center gap-1">
            <FormInput className="w-3 h-3" />
            {fieldsCount}
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
              <DialogTitle>حذف النموذج</DialogTitle>
              <DialogDescription>
                هل أنت متأكد من حذف - {form.title}
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
                  onDelete(form);
                }}
              >
                حذف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  );
}

// Skeleton loader for FormCard
export function FormCardSkeleton() {
  return (
    <div className="bg-white rounded-4xl border border-gray-100 p-3 animate-pulse">
      {/* Image Skeleton */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl mb-3" />
      
      {/* Content Skeleton */}
      <div className="text-right px-1">
        {/* Name & Type Row */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="h-4 bg-gray-200 rounded-md flex-1" />
          <div className="h-5 w-14 bg-gray-100 rounded-md" />
        </div>
        
        {/* Description */}
        <div className="space-y-1.5 mb-3">
          <div className="h-3 bg-gray-100 rounded-md w-full" />
          <div className="h-3 bg-gray-100 rounded-md w-3/4" />
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-3">
          <div className="h-3 w-8 bg-gray-100 rounded-md" />
          <div className="w-px h-3 bg-gray-100" />
          <div className="h-3 w-8 bg-gray-100 rounded-md" />
          <div className="w-px h-3 bg-gray-100" />
          <div className="h-3 w-8 bg-gray-100 rounded-md" />
        </div>
      </div>
    </div>
  );
}

interface FormsGridSkeletonProps {
  count?: number;
  variant?: 'grid' | 'list';
}

export function FormsGridSkeleton({
  count = 6,
  variant = 'grid',
}: FormsGridSkeletonProps) {
  return (
    <div
      className={
        variant === 'grid'
          ? 'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4'
          : 'flex flex-col gap-3'
      }
    >
      {Array.from({ length: count }).map((_, index) => (
        <FormCardSkeleton key={index} />
      ))}
    </div>
  );
}

export const FormCard = memo(FormCardComponent);
