/**
 * @file layout.tsx — Root Layout (App Router)
 *
 * This is the top-level layout for the entire AlbionOS application.
 * Every page in the app is rendered as a child of this layout.
 *
 * Key responsibilities:
 *  1. Sets the <html> and <body> elements for every route.
 *  2. Imports `globals.css`, which contains the full AlbionOS design system
 *     (CSS custom properties, resets, typography, component tokens).
 *  3. Exports Next.js `Metadata` for SEO (title, description).
 *
 * Font Loading Strategy:
 *  Open Sans is loaded via a CSS `@import url(...)` inside `globals.css`
 *  rather than through `next/font/google`. This choice was made because:
 *    - A single `@import` loads all required weights (300–800) and italic
 *      variants in one declaration, keeping configuration minimal.
 *    - The font is applied globally via the `:root` / `body` selectors in
 *      CSS, which aligns with the project's vanilla-CSS-only approach.
 *    - `next/font` would add a build-time optimisation (self-hosting the
 *      font files), but for this project the Google CDN with `display=swap`
 *      provides an acceptable trade-off of simplicity vs. performance.
 */

import type { Metadata } from "next";
import ClientLayout from "@/components/i18n/ClientLayout";
import "./globals.css";

/* ────────────────────────────────────────────
   SEO & Browser-Tab Metadata
   ──────────────────────────────────────────── */
export const metadata: Metadata = {
  title: "AlbionOS — Pharmaceutical Management Suite",
  description: "Enterprise management platform for Albion Pharmaceuticals. Manage inventory, sales, finance, and veterinary clinics.",
};

/* ────────────────────────────────────────────
   Root Layout Component
   ──────────────────────────────────────────── */

/**
 * RootLayout — the outermost server component shell for every page.
 *
 * @remarks
 * This component is a **Server Component** by default (no `'use client'`).
 * It never re-renders on the client and simply provides the HTML skeleton.
 * All client-side interactivity is handled by child components deeper in
 * the component tree.
 *
 * @param children - The page or nested layout rendered inside `<body>`.
 * @returns The full HTML document wrapper.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
