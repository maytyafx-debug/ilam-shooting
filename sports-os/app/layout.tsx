import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "هیئت تیراندازی استان ایلام | METATYA Sports OS", description: "درگاه عمومی اطلاع‌رسانی و خدمات دیجیتال هیئت تیراندازی استان ایلام" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="fa" dir="rtl"><body>{children}</body></html>; }
