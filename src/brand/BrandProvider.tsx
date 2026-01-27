import { useEffect } from "react";
import { TOBY_THEME_CSS_URL, TOBY_SPRITES_CSS_URL } from "./tobyBrand";

/**
 * BrandProvider – Injects brand stylesheets from CDN into document head
 * This component runs once on mount and adds the CSS files.
 * Uses fixed IDs to prevent duplicate injections.
 */
export function BrandProvider(): null {
  useEffect(() => {
    const links = [
      { id: "toby-brand-theme", href: TOBY_THEME_CSS_URL },
      { id: "toby-brand-sprites", href: TOBY_SPRITES_CSS_URL },
    ];

    links.forEach(({ id, href }) => {
      // Check if already exists
      if (document.getElementById(id)) {
        return;
      }

      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    });
  }, []);

  return null;
}
