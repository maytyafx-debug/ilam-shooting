# پورتال هیأت تیراندازی استان ایلام

راهنمای نصب، انتشار، پشتیبان‌گیری و نگهداری

- مخزن: https://github.com/maytyafx-debug/ilam-shooting
- شاخه اصلی: main
- شاخه پشتیبان: backup/2026-11-08
- فناوری پورتال عمومی ریشه: HTML، CSS، JavaScript و Cloudflare Pages Functions
- فناوری اپلیکیشن مدیریتی METATYA Sports OS در `sports-os/`: Next.js و Supabase Auth
- پورتال عمومی ریشه و اپلیکیشن Sports OS دو مقصد انتشار مستقل دارند؛ Cloudflare Pages برای پورتال ریشه و Netlify برای اپلیکیشن `sports-os/` است.
- پایگاه داده آمار پورتال: Supabase (اختیاری)

## 1. ساختار پروژه

- index.html: صفحه اصلی
- style.css و script.js: ظاهر و رفتار رابط
- analytics.js: کد آمار بازدید
- news.html، calendar.html، achievements.html، committees.html: صفحات محتوایی
- register-athlete.html، register-competition.html، register-member.html: صفحات ثبت‌نام
- assets/: فونت، نشان و تصاویر
- functions/api/submit.js: تابع سمت سرور برای ارسال فرم به تلگرام
- supabase/migrations/001_analytics.sql: ساختار اختیاری آمار بازدید

## 2. پیش‌نیازها

برای انتشار: حساب GitHub، حساب Cloudflare، ربات تلگرام و مرورگر به‌روز.
برای پیش‌نمایش پورتال استاتیک ریشه: Python 3 یا VS Code Live Server؛ این بخش به Node.js نیاز ندارد.
برای اپلیکیشن Next.js در `sports-os/`: Node.js نسخه 20.9 یا جدیدتر و npm لازم است؛ راهنمای مستقل Netlify در بخش 11 آمده است.

## 3. دریافت کد

~~~bash
git clone https://github.com/maytyafx-debug/ilam-shooting.git
cd ilam-shooting
git checkout main
~~~

برای نسخه پشتیبان:
~~~bash
git fetch origin
git checkout backup/2026-11-08
~~~

## 4. اجرای محلی

در پوشه اصلی اجرا کن:
~~~bash
python -m http.server 8080
~~~
در ویندوز می‌توانی از py -m http.server 8080 استفاده کنی.
سپس http://localhost:8080 را باز کن.

توجه: سرور ساده Python توابع Cloudflare را اجرا نمی‌کند؛ بنابراین مسیر /api/submit در پیش‌نمایش محلی فعال نیست. برای تست کامل فرم از Cloudflare Pages استفاده کن.

## 5. انتشار روی Cloudflare Pages

1. در داشبورد Cloudflare از Workers & Pages یک Pages project بساز.
2. اتصال Git را انتخاب و مخزن maytyafx-debug/ilam-shooting را متصل کن.
3. شاخه Production را main قرار بده.
4. Build command را خالی بگذار.
5. Build output directory را / قرار بده.
6. Root directory را / قرار بده و Deploy را اجرا کن.
7. پس از انتشار دامنه pages.dev را باز و صفحات را بررسی کن.

فایل functions/api/submit.js باید دقیقاً در همین مسیر باقی بماند تا Cloudflare مسیر /api/submit را بسازد.

GitHub Pages فقط فایل‌های استاتیک را ارائه می‌کند و تابع سمت سرور این پروژه را اجرا نمی‌کند؛ برای عملکرد فرم از Cloudflare Pages استفاده کن.

## 6. ربات تلگرام و متغیرهای محرمانه

1. در تلگرام به @BotFather برو و با /newbot ربات بساز.
2. توکن جدید بگیر و آن را فقط در محل امن نگه دار.
3. شناسه چت مقصد را مشخص کن. برای گروه، ربات را عضو گروه کن.
4. در Cloudflare مسیر Workers & Pages → پروژه Pages → Settings → Variables and Secrets را باز کن.
5. دو Secret بساز:
   - BOT_TOKEN: توکن جدید ربات
   - CHAT_ID: شناسه چت یا گروه مقصد
6. پس از ذخیره متغیرها یک Deploy جدید انجام بده.
7. با داده آزمایشی غیرواقعی، ارسال فرم و دریافت پیام را بررسی کن.

تابع سمت سرور از context.env.BOT_TOKEN و context.env.CHAT_ID می‌خواند. توکن را در فایل‌های HTML، JavaScript، GitHub یا پیام عمومی قرار نده.

### اقدام امنیتی ضروری

در نسخه قبلی تابع ارسال فرم، توکن تلگرام مستقیماً داخل کد قرار گرفته و در تاریخچه Git ثبت شده بود. توکن قبلی را افشاشده فرض کن:
- آن را در BotFather باطل کن و توکن تازه بساز.
- فقط توکن تازه را در Cloudflare Secret ثبت کن.
- حذف توکن از فایل به‌تنهایی کافی نیست؛ تاریخچه Git و شاخه‌های پشتیبان نیز ممکن است نسخه قدیمی را نگه داشته باشند.

## 7. آمار بازدید با Supabase (اختیاری)

فایل supabase/migrations/001_analytics.sql را بازبینی کن. سپس:
1. پروژه Supabase را باز کن.
2. وارد SQL Editor شو.
3. محتوای فایل مهاجرت را اجرا کن.
4. دسترسی‌ها و سیاست‌های امنیتی را بررسی کن.

این SQL جدول شمارش روزانه و توابع ثبت/خواندن آمار را می‌سازد؛ خودکار اجرا نمی‌شود. پیش از اتصال داشبورد مدیریتی، احراز هویت مدیر و مجوزهای خواندن آمار را تست کن.

## 8. بررسی پس از انتشار

- صفحه اصلی و لینک‌های منو باز شوند.
- صفحات اخبار، تقویم، افتخارات و کمیته‌ها بدون خطای 404 باز شوند.
- فونت و تصاویر assets بارگذاری شوند.
- منوی موبایل تست شود.
- فرم فقط پس از تنظیم Secrets آزمایش شود.
- پیام آزمایشی به مقصد تلگرام برسد.
- خطاهای Console و Network مرورگر بررسی شوند.

## 9. پشتیبان‌گیری و بازیابی

شاخه پشتیبان GitHub:
~~~bash
git fetch origin
git checkout backup/2026-11-08
~~~

ساخت یک نسخه مستقل شامل تاریخچه و refs دریافت‌شده:
~~~bash
git clone https://github.com/maytyafx-debug/ilam-shooting.git
cd ilam-shooting
git bundle create ../ilam-shooting-all-refs.bundle --all
~~~

فایل bundle را در فضای امن دیگری نگهداری کن.
فایل مهاجرت SQL فقط ساختار اولیه را نگه می‌دارد و جایگزین بکاپ داده‌های واقعی Supabase نیست؛ برای داده‌ها از قابلیت Backup یا ابزارهای رسمی Supabase استفاده کن.

## 10. حریم خصوصی و بهره‌برداری

- تا پیش از آزمون امنیتی و تأیید مسئول سامانه، اطلاعات واقعی و حساس ورزشکاران را از طریق فرم عمومی دریافت نکن.
- دسترسی پیام‌های ربات را به مدیران مجاز محدود کن.
- توکن‌ها را در Git commit نکن.
- اخبار، نتایج و اطلاعات ورزشکاران را پیش از انتشار از مرجع رسمی تأیید کن.
- برای تغییرات مهم، ابتدا شاخه پشتیبان جدید بساز.

آخرین به‌روزرسانی: 2026-11-08


## 11. انتشار اپلیکیشن METATYA Sports OS روی Netlify

این بخش فقط مربوط به اپلیکیشن Next.js داخل پوشه `sports-os/` است؛ تنظیمات Cloudflare Pages در بخش 5 برای پورتال استاتیک ریشه باقی می‌ماند.

### اتصال مخزن و شاخه انتشار

1. در Netlify گزینه **Add new project → Import an existing project** را انتخاب کن.
2. GitHub را متصل کن و مخزن `maytyafx-debug/ilam-shooting` را انتخاب کن.
3. **Production branch** را روی `main` قرار بده.
4. فایل `netlify.toml` در ریشه مخزن، پوشه پایه را روی `sports-os`، دستور build را روی `npm run build`، پوشه خروجی را روی `.next` و Node.js را روی نسخه 22 تنظیم می‌کند.
5. Next.js Runtime در Netlify به‌صورت خودکار شناسایی و نصب می‌شود؛ نیازی به نصب دستی `@netlify/plugin-nextjs` نیست.
6. هیچ rewrite عمومی از نوع `/* → /index.html` اضافه نکن؛ اپلیکیشن از SSR، App Router و API Route استفاده می‌کند.

### متغیرهای محیطی

در **Project configuration → Environment variables** دو مقدار زیر را برای محیط‌های **Production** و **Deploy Previews** ثبت کن. Scope هر دو باید شامل **Builds** و **Functions** باشد (گزینه All scopes نیز مناسب است):

- `NEXT_PUBLIC_SUPABASE_URL`: آدرس پروژه Supabase، مانند `https://PROJECT_REF.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: کلید عمومی `anon` یا `publishable` همان پروژه

این دو مقدار عمداً در کلاینت مرورگر قابل مشاهده‌اند؛ آن‌ها را Secret تلقی نکن. **هرگز** `service_role`، Secret API Key، رمز دیتابیس یا JWT secret را در متغیرهای `NEXT_PUBLIC_*` وارد نکن. هیچ مقدار واقعی را در Git commit نکن.

Node.js از طریق `netlify.toml` روی نسخه 22 تنظیم شده و نیازی به ثبت جداگانه آن در پنل نیست.

### پس از اولین Deploy

1. دامنه ایجادشده Netlify را باز کن و Build Logs را بررسی کن.
2. در Supabase → Authentication → URL Configuration، Site URL را به دامنه نهایی اختصاص بده.
3. اگر از callback ایمیل/OAuth استفاده می‌کنی، مسیر دقیق `https://YOUR-NETLIFY-DOMAIN/auth/callback` را به Redirect URLs مجاز اضافه کن؛ برای تست محلی نیز `http://localhost:3000/auth/callback` را ثبت کن.
4. ورود با حساب آزمایشی مجاز، Refresh داشبورد و APIهای اعضا/رویدادها/نتایج را با داده آزمایشی بررسی کن.
5. تا تکمیل آزمون‌های امنیتی باقی‌مانده، سایت را در حالت خصوصی/محدود نگه دار و داده واقعی ورزشکاران یا افراد زیر سن قانونی وارد نکن.

**این Deploy فقط کد برنامه را Build می‌کند. هیچ migration یا SQL روی Supabase اجرا نمی‌شود.** فایل‌های SQL موجود در مخزن را به‌عنوان دستور اجرای خودکار Netlify در نظر نگیر.
