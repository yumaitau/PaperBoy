"use client";

import { useState, type ReactNode } from "react";
import { Menu, Send } from "lucide-react";
import Link from "next/link";
import { PaperboyLogo } from "@/components/brand/paperboy-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Renders the mobile header and supplied navigation children in a left drawer whose
 * open state this component controls. Bubbling clicks on any anchor with an href,
 * including its descendants or an already-current destination, dismiss the drawer
 * without waiting for a route change. The header also provides a send-email shortcut.
 */
export function MobileDashboardNavigation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="dashboard-mobile-header">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button aria-label="Open navigation" size="icon" variant="ghost-paper">
            <Menu strokeWidth={1.6} />
          </Button>
        </SheetTrigger>
        <SheetContent
          className="dashboard-mobile-sheet"
          side="left"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a[href]")) {
              setOpen(false);
            }
          }}
        >
          <SheetTitle>PaperBoy navigation</SheetTitle>
          <SheetDescription>Open a PaperBoy workspace page.</SheetDescription>
          {children}
        </SheetContent>
      </Sheet>
      <PaperboyLogo compact />
      <Button asChild className="dashboard-mobile-send" size="sm">
        <Link href="/app/send">
          <span>Send</span>
          <Send aria-hidden="true" strokeWidth={1.6} />
        </Link>
      </Button>
    </header>
  );
}
