'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ProfileData {
  id: string;
  username: string;
  name?: string;
  bio?: string;
  avatar?: string;
  coverImage?: string;
  location?: string;
  visibility: string;
  createdAt: string;
  user: { id: string; name?: string };
  socialLinks: Array<{
    id: string;
    platform: string;
    url: string;
    title?: string | null;
    status?: string;
    totalClicks?: number;
    displayOrder: number;
  }>;
  _count?: { followers: number; following: number };
}

interface PhonePreviewContextValue {
  collapsed: boolean;
  toggle: () => void;
  profile: ProfileData | null;
  setProfile: (profile: ProfileData | null) => void;
}

export const PhonePreviewContext = createContext<PhonePreviewContextValue>({
  collapsed: false,
  toggle: () => {},
  profile: null,
  setProfile: () => {},
});

export function usePhonePreview() {
  return useContext(PhonePreviewContext);
}

export function PhonePreviewProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <PhonePreviewContext.Provider value={{ collapsed, toggle, profile, setProfile }}>
      {children}
    </PhonePreviewContext.Provider>
  );
}
