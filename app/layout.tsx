import type { Metadata } from "next";
import { UI_HEAD_SCRIPT } from "@/lib/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ohmline - Circuit Designer",
  description: "Design electronic circuits and compute their properties",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-ui is set by the head script before paint
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: UI_HEAD_SCRIPT }}
        />
        <noscript>
          {/* Looks are swapped at runtime, so they can't
              go through the CSS bundle */}
          {/* eslint-disable-next-line @next/next/no-css-tags */}
          <link rel="stylesheet" href="/ui/classic.css" />
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
