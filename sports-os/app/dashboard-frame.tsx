"use client";

import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "داشبورد", icon: "▦", selector: ".page-intro" },
  { label: "اعضا و ورزشکاران", icon: "♙", selector: ".stats" },
  { label: "مسابقات و رویدادها", icon: "▣", selector: ".analytics-panel" },
  { label: "ثبت عضو", icon: "＋", selector: ".form-grid" },
  { label: "نتایج و افتخارات", icon: "🏆", selector: ".results-table" },
];

export default function DashboardFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = useState("داشبورد");
  if (pathname !== "/") return <>{children}</>;

  function navigate(item: (typeof navigation)[number]) {
    setActive(item.label);
    const target = document.querySelector(item.selector);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="sports-frame">
      <aside className="sports-sidebar" aria-label="منوی اصلی سامانه">
        <div className="sports-brand">
          <div className="sports-brand-mark">ای</div>
          <div><strong>هیئت تیراندازی ایلام</strong><small>METATYA Sports OS</small></div>
        </div>
        <div className="sports-side-caption">مدیریت سازمان</div>
        <nav className="sports-nav">
          {navigation.map((item) => (
            <button key={item.label} type="button" className={active === item.label ? "sports-nav-item active" : "sports-nav-item"} onClick={() => navigate(item)}>
              <span className="sports-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sports-sidebar-footer">
          <span className="sports-online-dot" />
          <span>سامانه مستقل هیئت ایلام</span>
          <small>زیرساخت مشترک METATYA Sports OS</small>
        </div>
      </aside>
      <div className="sports-main">{children}</div>
    </div>
  );
}
