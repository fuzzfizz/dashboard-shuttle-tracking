import type { Metadata, Viewport } from "next";
import { Inter, Kanit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const kanit = Kanit({ weight: ['300', '400', '500', '600', '700'], subsets: ["thai", "latin"], variable: '--font-kanit' });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "ระบบติดตามรถรับ-ส่ง — Shuttle Tracking System",
  description: "Live shuttle tracking dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${inter.variable} ${kanit.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
