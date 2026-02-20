import { ReactNode } from "react";
import { Navigation } from "./Navigation";
import { Footer } from "./Footer";
import { PWAInstallPrompt } from "./member/PWAInstallPrompt";
import { ClassScheduleBanner } from "./ClassScheduleBanner";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <ClassScheduleBanner />
      <PWAInstallPrompt />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
