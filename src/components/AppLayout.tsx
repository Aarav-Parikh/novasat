import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { PageNav } from "./PageNav";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full">
      <div className="starfield" />
      <div className="relative z-10 flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <MobileNav />
          <div className="flex-1 w-full max-w-[1600px] mx-auto flex gap-8 px-4 sm:px-8 py-6 sm:py-10">
            <main className="flex-1 min-w-0 animate-fade-in">{children}</main>
            <PageNav />
          </div>
        </div>
      </div>
    </div>
  );
}
