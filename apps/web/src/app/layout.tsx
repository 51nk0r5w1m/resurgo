import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  description:
    "A secure, guided workspace for navigating the practical steps of divorce and separation.",
  title: {
    default: "Resurgo — Navigate today. Build tomorrow.",
    template: "%s | Resurgo",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#123b35",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
