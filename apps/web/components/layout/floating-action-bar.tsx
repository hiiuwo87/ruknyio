'use client';

import { memo, forwardRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface FloatingActionBarProps {
  children: React.ReactNode;
  className?: string;
  position?: 'top' | 'bottom';
  delay?: number;
}

interface FABButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  title?: string;
  variant?: 'default' | 'primary' | 'ghost';
  badge?: number;
  disabled?: boolean;
}

interface FABDividerProps {
  className?: string;
}

interface FABBadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

// ============================================
// Animation Config
// ============================================

const SPRING_CONFIG = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

// ============================================
// FloatingActionBar Component
// ============================================

export const FloatingActionBar = memo(function FloatingActionBar({
  children,
  className,
  position = 'top',
  delay = 0.2,
}: FloatingActionBarProps) {
  const shouldReduceMotion = useReducedMotion();
  
  const positionClasses = position === 'top' 
    ? 'fixed top-4 left-1/2 -translate-x-1/2' 
    : 'fixed bottom-4 left-1/2 -translate-x-1/2';

  const animationProps = shouldReduceMotion 
    ? {} 
    : {
        initial: { y: position === 'top' ? -20 : 20, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: { duration: 0.4, delay },
      };

  return (
    <div className={cn(positionClasses, 'z-30', className)}>
      <motion.div
        {...animationProps}
        className={cn(
          // Glass morphism effect
          "flex items-center gap-2 px-2 py-2",
          "bg-white/70 backdrop-blur-2xl",
          "rounded-full",
          "shadow-xl shadow-black/10",
          "border border-white/50"
        )}
        role="navigation"
        aria-label="شريط الإجراءات السريعة"
      >
        {children}
      </motion.div>
    </div>
  );
});

// ============================================
// FABButton Component
// ============================================

export const FABButton = memo(forwardRef<HTMLButtonElement, FABButtonProps>(
  function FABButton(
    {
      children,
      onClick,
      className,
      ariaLabel,
      title,
      variant = 'default',
      badge,
      disabled,
    },
    ref
  ) {
    const shouldReduceMotion = useReducedMotion();
    const motionProps = shouldReduceMotion 
      ? {} 
      : { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 } };

    const variantClasses = {
      default: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
      primary: "bg-[#193948] text-white hover:bg-[#193948]/90",
      ghost: "text-gray-600 hover:bg-white/50 hover:text-gray-900",
    };

    return (
      <motion.button
        ref={ref}
        {...motionProps}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "relative p-2.5 rounded-full transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#193948]/40",
          variantClasses[variant],
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        aria-label={ariaLabel}
        title={title || ariaLabel}
      >
        {children}
        {ariaLabel && <span className="sr-only">{ariaLabel}</span>}
        
        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold shadow-lg"
          >
            {badge > 9 ? '9+' : badge}
          </motion.span>
        )}
      </motion.button>
    );
  }
));

// ============================================
// FABDivider Component
// ============================================

export const FABDivider = memo(function FABDivider({ className }: FABDividerProps) {
  return <div className={cn("w-px h-6 bg-gray-200", className)} />;
});

// ============================================
// FABBadge Component
// ============================================

export const FABBadge = memo(function FABBadge({
  children,
  className,
  variant = 'default',
}: FABBadgeProps) {
  const variantClasses = {
    default: "bg-gray-100 text-gray-700",
    primary: "bg-[#193948] text-white",
    success: "bg-teal-50 text-teal-700",
    warning: "bg-orange-50 text-orange-700",
  };

  return (
    <div 
      className={cn(
        "px-3 py-1.5 rounded-full flex items-center gap-2",
        "text-sm font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </div>
  );
});

// ============================================
// FABGlassButton Component (for larger buttons like avatar)
// ============================================

export const FABGlassButton = memo(forwardRef<HTMLButtonElement, FABButtonProps>(
  function FABGlassButton(
    {
      children,
      onClick,
      className,
      ariaLabel,
      title,
      badge,
      disabled,
    },
    ref
  ) {
    const shouldReduceMotion = useReducedMotion();
    const motionProps = shouldReduceMotion 
      ? {} 
      : { whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 } };

    return (
      <motion.button
        ref={ref}
        {...motionProps}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "relative w-11 h-11 rounded-full flex items-center justify-center",
          "bg-white/70 backdrop-blur-2xl border border-white/50",
          "text-gray-600 hover:text-gray-900 hover:bg-white/90",
          "shadow-xl shadow-black/10 transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#193948]/40",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        aria-label={ariaLabel}
        title={title || ariaLabel}
      >
        {children}
        {ariaLabel && <span className="sr-only">{ariaLabel}</span>}
        
        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold shadow-lg"
          >
            {badge > 9 ? '9+' : badge}
          </motion.span>
        )}
      </motion.button>
    );
  }
));

// ============================================
// Export all components
// ============================================

export default FloatingActionBar;
