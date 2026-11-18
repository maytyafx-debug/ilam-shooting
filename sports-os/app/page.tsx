import Link from "next/link";

const sections = [
  { icon: "🏛️", title: "معرفی هیئت", text: "آشنایی با ساختار، مأموریت‌ها، کمیته‌ها و مسیرهای ارتباطی هیئت تیراندازی استان ایلام", href: "#about" },
  { icon: "📅", title: "مسابقات و رویدادها", text: "اطلاع از برنامه‌های رسمی، فراخوان‌ها، زمان‌بندی و نتایج منتشرشده", href: "#events" },
  { icon: "🏅", title: "افتخارات", text: "مرور دستاوردها و خبرهای تأییدشده ورزشکاران و تیم‌های استان", href: "#achievements" },
  { icon: "📢", title: "اخبار و اطلاعیه‌ها", text: "اطلاعیه‌های رسمی، اخبار و اطلاع‌رسانی عمومی هیئت", href: "#news" },
];

export default function PublicHomePage() {
  return (
    <div className="public-site">
      <div className="public-topline">
        <div className="public-container public-topline-inner">
          <span>سامانه اطلاع‌رسانی و خدمات دیجیتال ورزش</span>
          <span>استان ایلام</span>
        </div>
      </div>
      <header className="public-header">
        <div className="public-container public-header-inner">
          <Link href="/" className="public-brand" aria-label="صفحه اصلی هیئت">
            <span className="public-emblem">هـ</span>
            <span><strong>هیئت تیراندازی استان ایلام</strong><small>سامانه رسمی اطلاع‌رسانی و خدمات</small></span>
          </Link>
          <nav className="public-nav" aria-label="منوی اصلی">
            <a href="#about">درباره هیئت</a>
            <a href="#events">مسابقات و رویدادها</a>
            <a href="#news">اخبار و اطلاعیه‌ها</a>
            <a href="#contact">ارتباط با ما</a>
          </nav>
          <Link className="public-login" href="/login">ورود اعضا و مدیران <span>←</span></Link>
        </div>
      </header>

      <main className="public-main">
        <section className="public-hero">
          <div className="public-hero-pattern" aria-hidden="true" />
          <div className="public-container public-hero-content">
            <div className="public-eyebrow"><span /> پایگاه اطلاع‌رسانی هیئت تیراندازی استان ایلام</div>
            <h1>ورزش، <em>انضباط</em>،<br />تلاش و افتخار</h1>
            <p>درگاه عمومی هیئت تیراندازی استان ایلام؛ مرجعی برای آشنایی با فعالیت‌ها، پیگیری اطلاعیه‌ها و دسترسی به خدمات عمومی ورزشکاران و خانواده‌ها.</p>
            <div className="public-hero-actions">
              <a className="public-primary" href="#events">مشاهده رویدادها <span>←</span></a>
              <a className="public-outline" href="#about">آشنایی با هیئت</a>
            </div>
            <div className="public-hero-note"><span className="public-note-mark">✓</span> اطلاعات این صفحه برای عموم منتشر می‌شود؛ بخش‌های مدیریتی و پرونده‌های شخصی در این محیط نمایش داده نمی‌شوند.</div>
          </div>
          <div className="public-hero-seal" aria-hidden="true"><span>ILAM</span><strong>SPORT</strong><small>SPORTS FEDERATION</small></div>
        </section>

        <section className="public-container public-shortcuts" aria-label="دسترسی سریع">
          {sections.map((item) => (
            <a className="public-shortcut" href={item.href} key={item.title}>
              <span className="public-shortcut-icon">{item.icon}</span>
              <span><strong>{item.title}</strong><small>{item.text}</small></span>
              <b>←</b>
            </a>
          ))}
        </section>

        <section className="public-container public-section" id="about">
          <div className="public-section-heading">
            <div><span className="public-kicker">ABOUT THE BOARD</span><h2>درباره هیئت</h2></div>
            <span className="public-section-index">۰۱ / معرفی</span>
          </div>
          <div className="public-about-grid">
            <div className="public-about-copy">
              <h3>یک درگاه شفاف برای ارتباط با جامعه ورزش</h3>
              <p>این وب‌سایت برای اطلاع‌رسانی عمومی، معرفی ساختار و خدمات هیئت، انتشار برنامه‌های تأییدشده و فراهم‌کردن مسیر ارتباطی روشن برای ورزشکاران، مربیان، داوران و خانواده‌ها طراحی شده است.</p>
              <p>اطلاعات رسمی پس از بررسی و تأیید مسئولان مجاز هیئت در این بخش منتشر خواهد شد.</p>
            </div>
            <div className="public-about-card">
              <span className="public-card-symbol">هـ</span>
              <strong>هیئت تیراندازی استان ایلام</strong>
              <small>بستر دیجیتال مدیریت و اطلاع‌رسانی</small>
              <div className="public-card-rule" />
              <span>مدیریت یکپارچه · اطلاع‌رسانی عمومی · خدمات شخصی</span>
            </div>
          </div>
        </section>

        <section className="public-band" id="events">
          <div className="public-container public-band-inner">
            <div><span className="public-kicker">EVENTS & CALENDAR</span><h2>مسابقات و رویدادها</h2><p>فراخوان‌ها، برنامه‌ها و نتایج رسمی پس از تأیید و مجوز انتشار در این قسمت قرار می‌گیرند.</p></div>
            <div className="public-empty"><span>📅</span><strong>رویداد عمومی منتشرشده‌ای موجود نیست</strong><small>به‌محض ثبت و تأیید برنامه‌های قابل انتشار، این بخش به‌روزرسانی می‌شود.</small></div>
          </div>
        </section>

        <section className="public-container public-section public-two-sections">
          <div id="news" className="public-info-block">
            <span className="public-kicker">LATEST NEWS</span><h2>اخبار و اطلاعیه‌ها</h2>
            <div className="public-empty light"><span>📢</span><strong>اطلاعیه‌ای برای نمایش وجود ندارد</strong><small>فقط محتوای تأییدشده و عمومی در این بخش نمایش داده می‌شود.</small></div>
          </div>
          <div id="achievements" className="public-info-block">
            <span className="public-kicker">ACHIEVEMENTS</span><h2>افتخارات و نتایج</h2>
            <div className="public-empty light"><span>🏅</span><strong>مورد تأییدشده‌ای منتشر نشده است</strong><small>اطلاعات فردی و سوابق غیرعمومی ورزشکاران در این صفحه قرار نمی‌گیرد.</small></div>
          </div>
        </section>

        <section className="public-contact" id="contact">
          <div className="public-container public-contact-inner">
            <div><span className="public-kicker">CONTACT & SUPPORT</span><h2>در ارتباط بمانیم</h2><p>برای پیگیری امور شخصی، از پنل اختصاصی خود وارد شوید. اطلاعات تماس رسمی هیئت پس از ثبت و تأیید در همین قسمت درج خواهد شد.</p></div>
            <Link href="/login" className="public-primary">ورود به خدمات اعضا <span>←</span></Link>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="public-container public-footer-inner">
          <div><strong>هیئت تیراندازی استان ایلام</strong><small>درگاه عمومی اطلاع‌رسانی و خدمات دیجیتال</small></div>
          <div className="public-footer-links"><Link href="/login">ورود اعضا و مدیران</Link><Link href="/portal">پنل شخصی</Link></div>
          <small>زیرساخت نرم‌افزاری: METATYA Sports OS</small>
        </div>
      </footer>
    </div>
  );
}
