# METATYA Sports OS — اپلیکیشن و راهنمای استقرار

این پوشه شامل اپلیکیشن Next.js محصول METATYA Sports OS است. این برنامه در کنار دمو و پورتال استاتیک ریشه مخزن قرار دارد؛ بنابراین تمام فرمان‌های Node.js باید از همین پوشه اجرا شوند.

## وضعیت فعلی محصول

- اپلیکیشن بر پایه Next.js App Router است.
- ورود با Supabase Auth پیاده‌سازی شده است.
- نشست کاربر با cookie و middleware مدیریت می‌شود.
- هسته چندمستاجری در SQL با جدول‌های `sports_tenants`، `sports_tenant_memberships`، `sports_members`، `sports_events` و `sports_results` تعریف شده است.
- فایل `SUPABASE_FINAL_SETUP.sql` نسخه تجمیعی راه‌اندازی این جداول، سیاست‌های RLS، ایندکس‌ها و seed مدیر اولیه است.
- پنل قابل مشاهده، به‌تنهایی به معنی تکمیل همه گردش‌کارهای عملیاتی یا آمادگی Production نیست.

## نیازمندی‌ها

- Node.js نسخه 20.9 یا جدیدتر
- npm همراه Node.js
- پروژه Supabase فعال
- دسترسی مدیر به Supabase برای تنظیم Auth و اجرای SQL در محیط تازه

## اجرای محلی در Termux یا دسکتاپ

از ریشه مخزن وارد پوشه برنامه شوید:

```bash
cd sports-os
npm install
```

فایل محیط محلی را بسازید:

```bash
cp .env.example .env.local
```

مقادیر واقعی را در `.env.local` قرار دهید:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

سپس سرور توسعه را اجرا کنید:

```bash
npm run dev
```

آدرس محلی: `http://localhost:3000`

برای توقف سرور از `Ctrl + C` استفاده کنید.

## فرمان‌های کنترل کیفیت

همه فرمان‌ها را از پوشه `sports-os/` اجرا کنید:

```bash
npm run typecheck
npm run lint
npm run build
```

برای اجرای نسخه build‌شده:

```bash
npm run start
```

قبل از انتشار، هر سه کنترل typecheck، lint و build باید بدون خطا تمام شوند. صرفاً روشن‌شدن سرور توسعه، موفقیت build یا آمادگی Production را اثبات نمی‌کند.

## متغیرهای محیطی

| نام | کاربرد |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | آدرس API پروژه Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | کلید عمومی anon یا publishable که برای کلاینت مجاز است |

**هرگز** کلید `service_role` یا Secret API Key را در متغیرهای `NEXT_PUBLIC_*` قرار ندهید، در کد مرورگر استفاده نکنید یا در Git commit نکنید. فایل‌های `.env.local` و `.env.*.local` در `.gitignore` قرار دارند.

## استقرار روی Netlify

اپلیکیشن Next.js در زیرپوشه `sports-os/` قرار دارد. فایل `netlify.toml` در ریشه مخزن تنظیمات زیر را برای Netlify تعریف می‌کند:

- Base directory: `sports-os`
- Build command: `npm run build`
- Publish directory: `.next`
- Node.js: `22`
- Next.js Runtime: شناسایی و نصب خودکار توسط Netlify؛ نصب دستی پلاگین لازم نیست.

### اتصال Git

1. در Netlify گزینه **Add new project → Import an existing project** را انتخاب کنید.
2. مخزن `maytyafx-debug/ilam-shooting` را متصل کنید.
3. Production branch را `main` قرار دهید.
4. تأیید کنید Build settings با `netlify.toml` هم‌خوان است. در صورت نمایش Base directory در پنل، مقدار `sports-os` باشد.
5. برای Deploy Previewها، شاخه‌های غیر Production را در صورت نیاز فعال کنید.

### Environment Variables

در **Project configuration → Environment variables** این دو متغیر را برای Production و Deploy Previews ثبت کنید. Scope هر دو باید دست‌کم شامل **Builds** و **Functions** باشد:

| نام | مقدار |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | آدرس پروژه Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | کلید عمومی anon یا publishable همان پروژه |

هر دو متغیر public هستند و در مرورگر استفاده می‌شوند؛ آن‌ها را Secret علامت نزنید. از `service_role` یا Secret API Key استفاده نکنید. Node.js 22 از طریق `netlify.toml` تعیین شده است.

### بررسی بعد از Deploy

1. Build Logs را بررسی کنید و مطمئن شوید Next.js Runtime بدون خطا ساخته شده است.
2. دامنه نهایی را در Supabase → Authentication → URL Configuration ثبت کنید.
3. در صورت استفاده از Auth callback، `https://YOUR-NETLIFY-DOMAIN/auth/callback` را به Redirect URLs مجاز اضافه کنید.
4. ورود آزمایشی، Refresh، انتخاب سازمان و APIهای عملیاتی را با داده غیرواقعی تست کنید.
5. تا پیش از تکمیل ممیزی امنیتی، سایت را خصوصی یا محدود نگه دارید.

این Deploy فقط برنامه را Build می‌کند و هیچ SQL یا migration را روی Supabase اجرا نمی‌کند. برای راه‌اندازی دیتابیس فعلی، migration قدیمی یا فایل تجمیعی SQL را دوباره اجرا نکنید.

## راه‌اندازی Supabase در محیط تازه

**این بخش فقط برای یک پروژه Supabase کاملاً تازه و ایزوله است.** فایل `SUPABASE_FINAL_SETUP.sql` را روی پروژه پایلوت متصل یا دیتابیسی که جداول `public.sports_*` را دارد دوباره اجرا نکنید. این فایل صرفاً راهنمای آماده‌سازی محیط جدید است و اجرای آن در این مرحله مجاز یا لازم نیست.

فایل `SUPABASE_FINAL_SETUP.sql` یک اسکریپت مستقل و تجمیعی برای ساخت جداول چندمستاجری در schema عمومی `public` است. این فایل دو migration ثبت‌شده را تجمیع می‌کند:

- `20261117090249 — sports_multitenancy_core`
- `20261117090346 — sports_foreign_key_indexes`

مراحل محیط تازه:

1. ابتدا کاربر مدیر را در Supabase Authentication ایجاد کنید.
2. از دیتابیس هدف و تنظیمات آن نسخه پشتیبان تهیه کنید.
3. فایل SQL را باز کنید و فقط مقدار `ADMIN_EMAIL_PLACEHOLDER` را با ایمیل همان کاربر Auth جایگزین کنید.
4. کل فایل را در SQL Editor همان پروژه تازه اجرا کنید.
5. خروجی اجرا را بررسی کنید؛ سپس وجود پنج جدول، فعال‌بودن RLS، هشت policy و عضویت مدیر را تأیید کنید.

این seed فقط tenant آزمایشی/پایلوت «هیئت تیراندازی استان ایلام» و عضویت مدیر را ایجاد می‌کند. هیچ ورزشکار، والد، نتیجه، پرداخت، بیمه یا پرونده شخصی ساختگی ایجاد نمی‌شود.

**هشدار برای پروژه Supabase فعلی:** migrationهای چندمستاجری در پروژه فعلی قبلاً ثبت و اجرا شده‌اند. این فایل را برای بار دوم روی همان پروژه اجرا نکنید؛ به‌ویژه seed می‌تواند tenant دیگری بسازد. برای محیط موجود ابتدا migration history و داده‌ها را بررسی کنید.

## وضعیت اتصال دیتابیس و مرز آمادگی Production

در نسخه فعلی، کلاینت مرورگر و سرور Supabase هر دو از `db.schema: "public"` استفاده می‌کنند و با پنج جدول فعال `public.sports_tenants`، `public.sports_tenant_memberships`، `public.sports_members`، `public.sports_events` و `public.sports_results` هم‌راستا هستند. endpointهای اعضا، رویدادها و نتایج شناسه سازمان انتخاب‌شده را از هدر `x-tenant-id` دریافت می‌کنند، اما مجوز را فقط از نشست احراز هویت‌شده و عضویت فعال سمت سرور تعیین می‌کنند. انتخاب اخیر کاربر فقط در sessionStorage مرورگر نگهداری می‌شود و در هر بار بارگذاری دوباره با فهرست عضویت‌های معتبر تطبیق داده می‌شود.

با وجود موفقیت تست‌های اولیه ثبت عضو، رویداد و نتیجه، این موضوع به‌تنهایی ممیزی کامل Production نیست. پیش از ورود داده واقعی باید سیاست‌های RLS برای هر نقش، جداسازی tenant با دو حساب مستقل، مسیرهای احراز هویت، بازیابی پشتیبان و ثبت رخدادهای ممیزی جداگانه آزمون شوند. تا پایان این بررسی، Deployment را پیش‌نمایش فنی بدانید و اطلاعات حساس یا اطلاعات افراد زیر سن قانونی را وارد نکنید.

## ساختار اصلی برنامه

- `app/`: صفحات App Router، صفحه ورود، callback و API routes
- `lib/supabase/`: کلاینت‌های مرورگر و سرور و مدیریت نشست
- `lib/core-sports/`: قراردادها و سرویس‌های هسته ورزشی
- `middleware.ts`: تازه‌سازی نشست و هدایت کاربر
- `next.config.js`: تنظیمات Next.js و محدودسازی مسیرهای Watchpack در Termux
- `SUPABASE_FINAL_SETUP.sql`: راه‌اندازی دیتابیس چندمستاجری برای محیط تازه

## امنیت و نگهداری

- دسترسی tenant باید در سمت سرور و با عضویت معتبر کاربر تعیین شود؛ شناسه tenant ارسالی مرورگر به‌تنهایی قابل اعتماد نیست.
- RLS باید روی همه جدول‌های قابل دسترسی از Data API فعال باشد.
- برای عملیات مدیریتی حساس، فقط از مسیر سرور مورد اعتماد استفاده شود.
- قبل از ورود داده واقعی، کنترل دسترسی، جداسازی tenant، ثبت رویدادهای ممیزی، پشتیبان‌گیری و بازیابی آزمایش شوند.
- داده‌های واقعی ورزشکاران، اطلاعات تماس، سوابق پزشکی، مالی یا بیمه‌ای را تا تکمیل کنترل‌های امنیتی و رضایت‌های لازم وارد نکنید.
- تغییرات دیتابیس را با migration نسخه‌بندی‌شده انجام دهید؛ از اجرای SQL ناشناخته یا تکراری روی Production خودداری کنید.

## استاندارد مادر اکوسیستم METATYA

این پروژه علاوه بر استاندارد تخصصی Sports OS، ملزم به رعایت [استاندارد مادر مهندسی و حاکمیت اکوسیستم METATYA](https://github.com/maytyafx-debug/metatya-ai-core/blob/main/METATYA_ECOSYSTEM_STANDARD.md) است. استاندارد محلی این مخزن فقط جزئیات تخصصی محصول ورزشی را تکمیل می‌کند و جایگزین استاندارد مادر نیست.

## استاندارد مهندسی و معماری (مرجع الزامی)

قواعد مشترک معماری، چندمستاجری، امنیت، صحت داده، تست، توسعه ماژول‌های رشته‌ای و کنترل کیفیت در سند مرجع زیر ثبت شده‌اند و باید پیش از هر تغییر و انتشار مرور شوند:

- `docs/METATYA_ENGINEERING_STANDARD.md` — استاندارد مادر مهندسی METATYA Sports OS

این سند مرجع واحد قوانین مهندسی این مخزن است؛ قابلیت مشترک را برای هر رشته دوباره نسازید و هیچ قابلیت را بدون تست و شواهد «تأییدشده» اعلام نکنید.

## اسناد تکمیلی

- `MASTER_BLUEPRINT.md`: نقشه معماری محصول
- `FOUNDATION_SPEC.md`: مشخصات هسته و نقش‌ها
- `IMPLEMENTATION_BACKLOG.md`: وضعیت و مراحل توسعه
- `ARCHITECTURE.md`: معماری فنی و جداسازی tenant
- `README_NEXTJS.md`: راهنمای تکمیلی اپلیکیشن Next.js
- `SUPABASE_READ_ONLY_AUDIT_2026-11-16.md`: ممیزی پایه Supabase
