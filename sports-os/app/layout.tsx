import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "METATYA Sports OS", description: "سامانه مدیریت یکپارچه سازمان‌ها و باشگاه‌های ورزشی" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="fa" dir="rtl"><body>{children}</body></html>; }
