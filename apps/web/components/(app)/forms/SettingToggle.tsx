'use client';

import { Switch } from '@/components/ui/switch';

interface SettingToggleProps {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function SettingToggle({ title, description, checked, onCheckedChange }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-2xl transition-colors hover:bg-muted/50">
      <div className="flex-1 min-w-0 ml-3">
        <p className="font-medium text-sm text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
