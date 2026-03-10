'use client';

import { createContext, useContext } from 'react';

interface PhonePreviewContextValue {
  collapsed: boolean;
  toggle: () => void;
}

export const PhonePreviewContext = createContext<PhonePreviewContextValue>({
  collapsed: false,
  toggle: () => {},
});

export function usePhonePreview() {
  return useContext(PhonePreviewContext);
}
