import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "کارت افتخار ورزشکار | METATYA Sports OS",
  robots: { index: false, follow: false },
};
export default function PublicAthleteCardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
