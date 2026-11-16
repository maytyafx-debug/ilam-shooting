# METATYA Sports OS — Next.js application

این پوشه اکنون یک برنامه مستقل Next.js با App Router است و فایل‌های HTML/CSS/JS دمو در همین پوشه و ریشه مخزن را حذف یا جایگزین نمی‌کند.

## نیازمندی‌ها
- Node.js 20.9 یا جدیدتر
- یک پروژه Supabase که migration مربوط به Core Sports در آن پس از بازبینی اجرا شده باشد
- فعال بودن schema با نام `sports_core` در Supabase Dashboard → API Settings → Exposed schemas

## راه‌اندازی
از داخل پوشه `sports-os` اجرا کنید:

```bash
cp .env.example .env.local
# سپس مقادیر واقعی Supabase را در .env.local قرار دهید
npm install
npm run dev
```

برنامه در `http://localhost:3000` در دسترس خواهد بود. برای build از `npm run build` و برای اجرا از `npm run start` استفاده کنید.

## متغیرهای محیطی
- `NEXT_PUBLIC_SUPABASE_URL`: آدرس پروژه Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: کلید publishable/anon پروژه؛ کلید service-role را هرگز اینجا قرار ندهید.

## ساختار اصلی
- `app/`: صفحات App Router، callback احراز هویت و API routes
- `lib/supabase/`: کلاینت‌های مرورگر و سرور با cookie-based sessions
- `lib/core-sports/`: نقش‌ها، قراردادها و سرویس‌های مشترک Sports OS
- `middleware.ts`: تازه‌سازی نشست Supabase؛ مجوزدهی همچنان در API و RLS اعمال می‌شود

## دسترسی و داده
APIها از نشست کاربر استفاده می‌کنند و کلید service-role ندارند. نقش‌ها از `sports_core.profiles` خوانده می‌شوند. ایجاد عضو و رویداد فقط برای admin است؛ referee امکان خواندن اعضا/رویدادها و ثبت نتیجه را دارد. RLS دیتابیس مرجع نهایی مجوزهاست.

پروفایل نخستین مدیر باید از مسیر مورد اعتماد و پس از ساخت کاربر Auth provision شود؛ هیچ مسیر ثبت‌نام عمومی برای اعطای نقش admin وجود ندارد.

## Migration
فایل migration فعلی در مسیر `../supabase/migrations/004_core_sports.sql` قرار دارد. این migration را کورکورانه یا دوباره اجرا نکنید؛ ابتدا وضعیت دیتابیس هدف و وجود policy/triggerها بررسی شود. اجرای migration در این commit انجام نشده است.

## وضعیت اعتبارسنجی
ساختار و کد در Git ثبت شده‌اند، اما `npm install`, build، اتصال زنده Supabase و آزمون RLS در این محیط اجرا نشده‌اند. این برنامه پایه‌ی اجرایی است، نه اعلام آمادگی production.
