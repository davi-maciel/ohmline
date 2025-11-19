import type { Metadata } from "next";
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
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
