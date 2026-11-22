"use client";

import { useMemo, useState } from "react";
import styles from "./dashboard-preview.module.css";

const modules = [
  { id: "overview", icon: "▦", title: "نمای مدیریتی", description: "خلاصه وضعیت و شاخص‌های کلان" },
  { id: "organization", icon: "▣", title: "ساختار سازمانی", description: "واحدها، شهرستان‌ها و مسئولیت‌ها" },
  { id: "directory", icon: "▤", title: "اطلاعات پایه سازمان", description: "پرونده‌ها و اطلاعات سازمانی" },
  { id: "people", icon: "♙", title: "منابع انسانی", description: "پرونده پرسنلی و سوابق همکاری" },
  { id: "documents", icon: "▧", title: "اسناد و مکاتبات", description: "دبیرخانه و بایگانی دیجیتال" },
  { id: "finance", icon: "◈", title: "امور مالی", description: "بودجه و گزارش‌های مالی" },
  { id: "assets", icon: "▦", title: "اموال و دارایی‌ها", description: "دارایی‌ها و موجودی سازمان" },
  { id: "communications", icon: "✉", title: "ارتباطات", description: "اطلاعیه‌ها و درخواست‌های داخلی" },
  { id: "reports", icon: "▥", title: "گزارش‌های مدیریتی", description: "تحلیل و خروجی گزارش‌ها" },
  { id: "security", icon: "⬡", title: "کاربران و امنیت", description: "حساب‌ها و سطح دسترسی" },
  { id: "settings", icon: "⚙", title: "تنظیمات سامانه", description: "پیکربندی و سرویس‌ها" },
];

const metrics = [
  { label: "پرونده‌های سازمانی", value: "—", note: "پس از اتصال منبع داده" },
  { label: "واحدهای سازمانی", value: "—", note: "پس از تکمیل ساختار" },
  { label: "اسناد ثبت‌شده", value: "—", note: "پس از اتصال بایگانی" },
  { label: "درخواست‌های باز", value: "—", note: "پس از فعال‌سازی گردش کار" },
];

export default function DashboardPreviewPage() {
  const [active, setActive] = useState("overview");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const activeModule = modules.find((item) => item.id === active) ?? modules[0];
  const visibleModules = useMemo(
    () => modules.filter((item) => item.title.includes(query.trim()) || item.description.includes(query.trim())),
    [query],
  );

  return (
    <div className={styles.app} dir="rtl">
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>M</div>
          <div><strong>METATYA</strong><span>SPORTS OS</span></div>
        </div>
        <div className={styles.orgLabel}>فضای کاری</div>
        <div className={styles.orgCard}><span className={styles.orgIcon}>IL</span><span><b>هیئت استان ایلام</b><small>پنل مدیریت سازمانی</small></span><span className={styles.chevron}>⌄</span></div>
        <div className={styles.menuCaption}>مدیریت سازمان</div>
        <nav className={styles.nav} aria-label="منوی اصلی">
          {visibleModules.map((item) => (
            <button key={item.id} className={active === item.id ? styles.navActive : styles.navItem} onClick={() => { setActive(item.id); setNotice(""); }}>
              <span className={styles.navIcon}>{item.icon}</span><span>{item.title}</span>{active === item.id && <i />}
            </button>
          ))}
          {visibleModules.length === 0 && <p className={styles.noResults}>موردی پیدا نشد.</p>}
        </nav>
        <div className={styles.sidebarFoot}><span className={styles.onlineDot} /> پیش‌نمایش رابط کاربری <small>بدون اتصال به داده واقعی</small></div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>METATYA <span>/</span> SPORTS OS <span>/</span> <b>{activeModule.title}</b></div>
          <div className={styles.topActions}><span className={styles.previewPill}>نسخه نمایشی</span><button className={styles.avatar} aria-label="حساب کاربری نمایشی">م</button></div>
        </header>

        <section className={styles.content}>
          <div className={styles.welcome}>
            <div><div className={styles.eyebrow}>ILAM PROVINCIAL ORGANIZATION</div><h1>{active === "overview" ? "داشبورد مدیریتی" : activeModule.title}</h1><p>{active === "overview" ? "نمای یکپارچه مدیریت و نظارت بر بخش‌های سازمان" : activeModule.description}</p></div>
            <div className={styles.dateChip}><span>◷</span> نمای آزمایشی · داده زنده متصل نیست</div>
          </div>

          {active === "overview" ? (
            <>
              <div className={styles.metrics}>
                {metrics.map((metric, index) => <article className={styles.metric} key={metric.label}><div className={styles.metricTop}><span>{metric.label}</span><i>{["▤", "▣", "▧", "◷"][index]}</i></div><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
              </div>
              <div className={styles.mainGrid}>
                <section className={styles.panel}>
                  <div className={styles.panelHead}><div><h2>نمای کلی سازمان</h2><p>وضعیت ماژول‌های مدیریتی</p></div><span className={styles.softTag}>۱۱ ماژول</span></div>
                  <div className={styles.moduleGrid}>
                    {modules.slice(1).map((item) => <button className={styles.moduleCard} key={item.id} onClick={() => setActive(item.id)}><span className={styles.moduleIcon}>{item.icon}</span><span><b>{item.title}</b><small>{item.description}</small></span><span className={styles.arrow}>←</span></button>)}
                  </div>
                </section>
                <aside className={styles.rightStack}>
                  <section className={styles.panel}>
                    <div className={styles.panelHead}><div><h2>وضعیت اتصال داده‌ها</h2><p>وضعیت این پیش‌نمایش</p></div></div>
                    <div className={styles.connection}><span className={styles.connectionIcon}>⌁</span><div><b>اتصال پایگاه داده</b><small>در این پیش‌نمایش غیرفعال است</small></div><span className={styles.neutralStatus}>آزمایشی</span></div>
                    <div className={styles.connection}><span className={styles.connectionIcon}>◈</span><div><b>احراز هویت</b><small>از پنل اصلی استفاده می‌شود</small></div><span className={styles.neutralStatus}>جداگانه</span></div>
                    <div className={styles.connection}><span className={styles.connectionIcon}>⬡</span><div><b>ثبت رویداد سیستمی</b><small>در مرحله اتصال</small></div><span className={styles.neutralStatus}>آماده‌سازی</span></div>
                  </section>
                  <section className={styles.callout}><span>✦</span><div><b>طراحی یکپارچه</b><p>ماژول‌ها در یک ساختار واحد قرار گرفته‌اند. اتصال هر بخش به داده واقعی باید پس از تعریف مجوزها و ساختار ذخیره‌سازی انجام شود.</p></div></section>
                </aside>
              </div>
              <section className={styles.panel}>
                <div className={styles.panelHead}><div><h2>فعالیت‌های اخیر</h2><p>نمونه چیدمان بخش گزارش فعالیت</p></div><span className={styles.softTag}>بدون داده نمونه</span></div>
                <div className={styles.empty}><span>◷</span><b>هنوز فعالیتی برای نمایش وجود ندارد</b><small>پس از اتصال امن گزارش فعالیت، رویدادهای واقعی در این قسمت نمایش داده می‌شوند.</small></div>
              </section>
            </>
          ) : (
            <section className={styles.panel}>
              <div className={styles.panelHead}><div><h2>{activeModule.title}</h2><p>{activeModule.description}</p></div><span className={styles.softTag}>قالب ماژول</span></div>
              <div className={styles.moduleIntro}><span className={styles.moduleIntroIcon}>{activeModule.icon}</span><div><b>فضای اختصاصی {activeModule.title}</b><p>ساختار رابط کاربری این بخش در داشبورد یکپارچه تعریف شده است. داده‌ها و عملیات آن تا زمان طراحی مدل داده و مجوزهای مربوطه متصل نیستند.</p></div></div>
              <div className={styles.placeholderRows}><div><span>وضعیت ماژول</span><b>در انتظار اتصال داده</b></div><div><span>منبع ذخیره‌سازی</span><b>پس از طراحی مدل داده تعیین می‌شود</b></div><div><span>دسترسی</span><b>نیازمند تعریف نقش و مجوز</b></div></div>
              <button className={styles.backButton} onClick={() => setActive("overview")}>بازگشت به نمای مدیریتی</button>
            </section>
          )}
          {notice && <p role="status">{notice}</p>}
          <footer className={styles.footer}>METATYA SPORTS OS <span>•</span> طراحی یکپارچه رابط مدیریتی <span>•</span> پیش‌نمایش بدون داده واقعی</footer>
        </section>
      </main>
    </div>
  );
}
