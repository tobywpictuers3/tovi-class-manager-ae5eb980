// src/brand/BrandProvider.tsx
import { useLayoutEffect } from "react";
import { TOBY_THEME_CSS_URL, TOBY_SPRITES_CSS_URL } from "./tobyBrand";

/**
 * Inject brand CSS links into <head> immediately (sync-safe).
 * Uses fixed IDs to prevent duplicates.
 */
export function ensureBrandStylesheets(): void {
  const links = [
    { id: "toby-brand-theme", href: TOBY_THEME_CSS_URL },
    { id: "toby-brand-sprites", href: TOBY_SPRITES_CSS_URL },
  ];

  for (const { id, href } of links) {
    if (document.getElementById(id)) continue;

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

/**
 * Optional React component (kept for compatibility).
 * Uses useLayoutEffect to run BEFORE paint.
 */
export function BrandProvider(): null {
  useLayoutEffect(() => {
    ensureBrandStylesheets();
  }, []);

  return null;
}
