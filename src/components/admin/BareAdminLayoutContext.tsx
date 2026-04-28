import { createContext, useContext, ReactNode } from "react";

/**
 * When true, AdminLayout should render its children only (no sidebar, no header,
 * no chimes) because the surrounding shell — like KioskShell — already provides
 * its own chrome. This lets us reuse admin pages inside kiosk modes without
 * doubling up on UI.
 */
const BareAdminLayoutContext = createContext(false);

export function BareAdminLayoutProvider({ children }: { children: ReactNode }) {
  return (
    <BareAdminLayoutContext.Provider value={true}>
      {children}
    </BareAdminLayoutContext.Provider>
  );
}

export function useBareAdminLayout() {
  return useContext(BareAdminLayoutContext);
}
