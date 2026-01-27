// src/brand/BrandProvider.tsx
import { useEffect } from "react";
import { TOBY_THEME_CSS_URL, TOBY_SPRITES_CSS_URL } from "./tobyBrand";

function injectLink(id: string, href: string) {
  const existing = document.getElementById(id) as HTMLLinkElement | null;

  if (existing) {
    // keep it updated if href changed (version/bust change)
    if (existing.href !== href) existing.href = href;
    return;
  }

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export default function BrandProvider() {
  useEffect(() => {
    injectLink("toby-brand-theme", TOBY_THEME_CSS_URL);
    injectLink("toby-brand-sprites", TOBY_SPRITES_CSS_URL);
  }, []);

  return null;
}
