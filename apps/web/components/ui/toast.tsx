'use client';

import { forwardRef, useImperativeHandle, useRef, createContext, useContext, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Toaster as SonnerToaster,
  toast as sonnerToast,
} from 'sonner';
import {
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────

type Variant = 'default' | 'success' | 'error' | 'warning';
type Position =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

interface ActionButton {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost';
}

interface ToastShowProps {
  title?: string;
  message: string;
  variant?: Variant;
  duration?: number;
  position?: Position;
  actions?: ActionButton;
  onDismiss?: () => void;
  highlightTitle?: boolean;
}

export interface ToasterRef {
  show: (props: ToastShowProps) => void;
}

// ─── Variant Styling ──────────────────────────────────────────

const variantStyles: Record<Variant, string> = {
  default: 'bg-card border-border text-foreground',
  success: 'bg-card border-green-600/50',
  error: 'bg-card border-destructive/50',
  warning: 'bg-card border-amber-600/50',
};

const titleColor: Record<Variant, string> = {
  default: 'text-foreground',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
};

const iconColor: Record<Variant, string> = {
  default: 'text-muted-foreground',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
};

const variantIcons: Record<Variant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
};

const actionBtnColor: Record<Variant, string> = {
  default: 'text-foreground border-border hover:bg-muted/10 dark:hover:bg-muted/20',
  success: 'text-green-600 border-green-600 hover:bg-green-600/10 dark:hover:bg-green-400/20',
  error: 'text-destructive border-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20',
  warning: 'text-amber-600 border-amber-600 hover:bg-amber-600/10 dark:hover:bg-amber-400/20',
};

const toastAnimation = {
  initial: { opacity: 0, y: 50, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 50, scale: 0.95 },
};

// ─── Toaster Component ────────────────────────────────────────

const Toaster = forwardRef<ToasterRef, { defaultPosition?: Position }>(
  ({ defaultPosition = 'bottom-right' }, ref) => {
    useImperativeHandle(ref, () => ({
      show({
        title,
        message,
        variant = 'default',
        duration = 4000,
        position = defaultPosition,
        actions,
        onDismiss,
        highlightTitle,
      }) {
        const Icon = variantIcons[variant];

        sonnerToast.custom(
          (toastId) => (
            <motion.div
              variants={toastAnimation}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={cn(
                'flex items-center justify-between w-full max-w-xs p-3 rounded-xl border shadow-md',
                variantStyles[variant]
              )}
            >
              <div className="flex items-start gap-2 min-w-0">
                <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', iconColor[variant])} />
                <div className="space-y-0.5 min-w-0">
                  {title && (
                    <h3
                      className={cn(
                        'text-xs font-medium leading-none',
                        highlightTitle ? titleColor.success : titleColor[variant]
                      )}
                    >
                      {title}
                    </h3>
                  )}
                  <p className="text-xs text-muted-foreground">{message}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ms-2">
                {actions?.label && (
                  <button
                    type="button"
                    onClick={() => {
                      actions.onClick();
                      sonnerToast.dismiss(toastId);
                    }}
                    className={cn(
                      'cursor-pointer text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors',
                      actionBtnColor[variant]
                    )}
                  >
                    {actions.label}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    sonnerToast.dismiss(toastId);
                    onDismiss?.();
                  }}
                  className="rounded-full p-1 hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors focus:outline-none"
                  aria-label="إغلاق"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </motion.div>
          ),
          { duration, position }
        );
      },
    }));

    return (
      <SonnerToaster
        position={defaultPosition}
        toastOptions={{ unstyled: true, className: 'flex justify-end' }}
      />
    );
  }
);

Toaster.displayName = 'Toaster';

// ─── Global Toast Context ─────────────────────────────────────
// Allows using toast.success() / toast.error() anywhere without passing refs

type ToastFn = (message: string, options?: Omit<ToastShowProps, 'message' | 'variant'>) => void;

interface ToastAPI {
  show: (props: ToastShowProps) => void;
  success: ToastFn;
  error: ToastFn;
  warning: ToastFn;
  info: ToastFn;
}

const ToastContext = createContext<ToastAPI | null>(null);

export function ToastProvider({
  children,
  position = 'bottom-right',
}: {
  children: React.ReactNode;
  position?: Position;
}) {
  const toasterRef = useRef<ToasterRef>(null);

  const show = useCallback((props: ToastShowProps) => {
    toasterRef.current?.show(props);
  }, []);

  const success = useCallback<ToastFn>((message, options) => {
    show({ ...options, message, variant: 'success' });
  }, [show]);

  const error = useCallback<ToastFn>((message, options) => {
    show({ ...options, message, variant: 'error' });
  }, [show]);

  const warning = useCallback<ToastFn>((message, options) => {
    show({ ...options, message, variant: 'warning' });
  }, [show]);

  const info = useCallback<ToastFn>((message, options) => {
    show({ ...options, message, variant: 'default' });
  }, [show]);

  const api: ToastAPI = { show, success, error, warning, info };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster ref={toasterRef} defaultPosition={position} />
    </ToastContext.Provider>
  );
}

/**
 * Hook to access the global toast API.
 *
 * ```tsx
 * const toast = useToast();
 * toast.success('تم الحفظ بنجاح');
 * toast.error('حدث خطأ');
 * toast.warning('تحذير');
 * toast.info('ملاحظة');
 * toast.show({ title: '...', message: '...', variant: 'success', actions: { label: 'تراجع', onClick: () => {} } });
 * ```
 */
export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>');
  }
  return ctx;
}

export default Toaster;
