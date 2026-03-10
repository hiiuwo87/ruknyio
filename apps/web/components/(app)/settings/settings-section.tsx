'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('rounded-2xl bg-muted/30 p-5 sm:p-6 transition-all duration-300', className)}
    >
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </motion.div>
  );
}

interface SettingsFieldProps {
  label: string;
  htmlFor?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  horizontal?: boolean;
}

export function SettingsField({
  label,
  htmlFor,
  description,
  children,
  className,
  horizontal = false,
}: SettingsFieldProps) {
  if (horizontal) {
    return (
      <div className={cn('flex items-center justify-between gap-4', className)}>
        <div className="min-w-0">
          <label
            htmlFor={htmlFor}
            className="text-[13px] font-medium text-foreground"
          >
            {label}
          </label>
          {description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <label
        htmlFor={htmlFor}
        className="text-[13px] font-medium text-foreground"
      >
        {label}
      </label>
      {description && (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  );
}

interface SettingsRowProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsRow({ children, className }: SettingsRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl bg-background/50 px-4 py-3 transition-all duration-300',
        className
      )}
    >
      {children}
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  id,
}: ToggleSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
          checked ? '-translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}
