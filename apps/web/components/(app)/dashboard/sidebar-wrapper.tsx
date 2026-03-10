'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './dashboard-sidebar';
import { SettingsSidebarDesktop } from '@/components/(app)/settings/SettingsSidebar';

export function SidebarWrapper() {
  const pathname = usePathname();
  const isSettings = pathname?.startsWith('/app/settings');

  if (isSettings) {
    return (
      <div className="hidden lg:flex">
        <SettingsSidebarDesktop />
      </div>
    );
  }

  return <Sidebar />;
}
