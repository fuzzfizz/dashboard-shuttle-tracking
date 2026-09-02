import type { Metadata } from "next";
import { Inter, Kanit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const kanit = Kanit({ weight: ['300', '400', '500', '600', '700'], subsets: ["thai", "latin"], variable: '--font-kanit' });

export const metadata: Metadata = {
  title: "ระบบติดตามรถรับ-ส่ง — Shuttle Tracking System",
  description: "Live shuttle tracking dashboard",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
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
