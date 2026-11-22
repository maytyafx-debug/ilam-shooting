export type AdminFieldType = "text" | "date" | "datetime-local" | "number" | "select";

export interface AdminField {
  key: string;
  label: string;
  type: AdminFieldType;
  required?: boolean;
  maxLength?: number;
  min?: number;
  options?: readonly { value: string; label: string }[];
}

export interface AdminModule {
  recordType: string;
  title: string;
  fields: readonly AdminField[];
}

const statusOptions = [
  { value: "active", label: "فعال" },
  { value: "pending", label: "در انتظار بررسی" },
  { value: "archived", label: "بایگانی" },
] as const;

export const ADMIN_MODULES: Record<string, AdminModule> = {
  organization: {
    recordType: "organization_unit",
    title: "ساختار سازمانی",
    fields: [
      { key: "unit_type", label: "نوع واحد", type: "select", required: true, options: [
        { value: "board", label: "هیئت" }, { value: "committee", label: "کمیته" },
        { value: "county", label: "واحد شهرستانی" }, { value: "club", label: "باشگاه" },
        { value: "center", label: "مرکز" },
      ] },
      { key: "code", label: "کد اداری", type: "text", maxLength: 40 },
      { key: "parent_id", label: "شناسه واحد بالادست", type: "text", maxLength: 36 },
    ],
  },
  clubs: {
    recordType: "club",
    title: "باشگاه‌ها و مراکز",
    fields: [
      { key: "code", label: "کد ثبت", type: "text", maxLength: 40 },
      { key: "address", label: "نشانی اداری", type: "text", maxLength: 500 },
      { key: "administrative_status", label: "وضعیت", type: "select", required: true, options: statusOptions },
    ],
  },
  professionals: {
    recordType: "professional",
    title: "کارشناسان و عوامل",
    fields: [
      { key: "category", label: "گروه حرفه‌ای", type: "text", required: true, maxLength: 100 },
      { key: "credential_reference", label: "شناسه اعتبارنامه", type: "text", maxLength: 100 },
      { key: "issuer", label: "مرجع صادرکننده", type: "text", maxLength: 160 },
      { key: "expires_on", label: "تاریخ اعتبار تا", type: "date" },
    ],
  },
  membership: {
    recordType: "membership",
    title: "عضویت و تمدید",
    fields: [
      { key: "member_id", label: "شناسه عضو", type: "text", required: true, maxLength: 36 },
      { key: "starts_on", label: "شروع دوره", type: "date", required: true },
      { key: "ends_on", label: "پایان دوره", type: "date", required: true },
      { key: "membership_status", label: "وضعیت عضویت", type: "select", required: true, options: [
        { value: "pending", label: "در انتظار" }, { value: "active", label: "فعال" },
        { value: "expired", label: "منقضی" }, { value: "revoked", label: "لغوشده" },
      ] },
    ],
  },
  calendar: {
    recordType: "calendar",
    title: "تقویم و برنامه‌های اداری",
    fields: [
      { key: "starts_at", label: "زمان شروع", type: "datetime-local", required: true },
      { key: "ends_at", label: "زمان پایان", type: "datetime-local" },
      { key: "location", label: "محل برگزاری", type: "text", maxLength: 180 },
      { key: "notes", label: "توضیحات اداری", type: "text", maxLength: 2000 },
    ],
  },
  insurance: {
    recordType: "insurance",
    title: "بیمه و پوشش‌ها",
    fields: [
      { key: "member_id", label: "شناسه عضو", type: "text", required: true, maxLength: 36 },
      { key: "provider", label: "ارائه‌دهنده پوشش", type: "text", required: true, maxLength: 160 },
      { key: "policy_reference", label: "شناسه پرونده", type: "text", required: true, maxLength: 100 },
      { key: "starts_on", label: "شروع پوشش", type: "date", required: true },
      { key: "ends_on", label: "پایان پوشش", type: "date", required: true },
      { key: "coverage_status", label: "وضعیت", type: "select", required: true, options: statusOptions },
    ],
  },
  finance: {
    recordType: "finance",
    title: "امور مالی اداری",
    fields: [
      { key: "entry_type", label: "نوع سند", type: "select", required: true, options: [
        { value: "income", label: "دریافت" }, { value: "expense", label: "پرداخت" },
      ] },
      { key: "reference", label: "شماره مرجع", type: "text", required: true, maxLength: 100 },
      { key: "amount", label: "مبلغ", type: "number", required: true, min: 0 },
      { key: "currency", label: "واحد پول", type: "text", required: true, maxLength: 3 },
      { key: "occurred_on", label: "تاریخ سند", type: "date", required: true },
      { key: "financial_status", label: "وضعیت", type: "select", required: true, options: [
        { value: "draft", label: "پیش‌نویس" }, { value: "approved", label: "تأییدشده" },
        { value: "paid", label: "تسویه‌شده" }, { value: "void", label: "باطل‌شده" },
      ] },
    ],
  },
  documents: {
    recordType: "document",
    title: "دبیرخانه و اسناد",
    fields: [
      { key: "category", label: "نوع سند", type: "text", required: true, maxLength: 100 },
      { key: "classification", label: "سطح دسترسی", type: "select", required: true, options: [
        { value: "internal", label: "داخلی" }, { value: "confidential", label: "محرمانه" },
        { value: "restricted", label: "محدود" },
      ] },
      { key: "storage_reference", label: "شناسه محل نگهداری امن", type: "text", maxLength: 180 },
      { key: "version", label: "نسخه", type: "number", min: 1 },
      { key: "retention_until", label: "تاریخ بازبینی نگهداری", type: "date" },
    ],
  },
  facilities: {
    recordType: "asset",
    title: "اماکن و دارایی‌ها",
    fields: [
      { key: "asset_type", label: "نوع دارایی", type: "text", required: true, maxLength: 100 },
      { key: "location", label: "محل استقرار", type: "text", maxLength: 180 },
      { key: "condition", label: "وضعیت عمومی", type: "select", required: true, options: [
        { value: "good", label: "مناسب" }, { value: "maintenance", label: "نیازمند نگهداری" },
        { value: "out_of_service", label: "خارج از سرویس" },
      ] },
      { key: "maintenance_due", label: "تاریخ بازبینی بعدی", type: "date" },
    ],
  },
  communications: {
    recordType: "announcement",
    title: "اطلاع‌رسانی",
    fields: [
      { key: "body", label: "متن اطلاعیه", type: "text", required: true, maxLength: 4000 },
      { key: "audience", label: "مخاطبان", type: "select", required: true, options: [
        { value: "tenant_admins", label: "مدیران سازمان" }, { value: "all_members", label: "اعضای مجاز" },
        { value: "staff", label: "کارکنان" },
      ] },
      { key: "publish_at", label: "زمان انتشار", type: "datetime-local" },
    ],
  },
  training: {
    recordType: "training",
    title: "آموزش و توسعه",
    fields: [
      { key: "course_name", label: "عنوان دوره", type: "text", required: true, maxLength: 180 },
      { key: "starts_at", label: "زمان شروع", type: "datetime-local", required: true },
      { key: "ends_at", label: "زمان پایان", type: "datetime-local" },
      { key: "location", label: "محل برگزاری", type: "text", maxLength: 180 },
      { key: "capacity", label: "ظرفیت", type: "number", min: 1 },
    ],
  },
  honours: {
    recordType: "honour",
    title: "آرشیو افتخارات",
    fields: [
      { key: "member_id", label: "شناسه عضو", type: "text", required: true, maxLength: 36 },
      { key: "title", label: "عنوان افتخار", type: "text", required: true, maxLength: 180 },
      { key: "awarding_body", label: "مرجع اعطا", type: "text", maxLength: 160 },
      { key: "awarded_on", label: "تاریخ ثبت", type: "date" },
      { key: "certificate_reference", label: "شناسه گواهی", type: "text", maxLength: 120 },
    ],
  },
};

export const ADMIN_RECORD_TYPES = Object.values(ADMIN_MODULES).map((module) => module.recordType);

export function validateAdminPayload(recordType: string, value: unknown):
  | { ok: true; payload: Record<string, string | number> }
  | { ok: false; error: string } {
  const module = Object.values(ADMIN_MODULES).find((item) => item.recordType === recordType);
  if (!module || !value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Invalid module data." };
  }

  const input = value as Record<string, unknown>;
  const allowed = new Set(module.fields.map((field) => field.key));
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    return { ok: false, error: "Unexpected field in module data." };
  }

  const payload: Record<string, string | number> = {};
  for (const field of module.fields) {
    const raw = input[field.key];
    if (raw === undefined || raw === null || raw === "") {
      if (field.required) return { ok: false, error: `Missing required field: ${field.key}.` };
      continue;
    }
    if (field.type === "number") {
      const numberValue = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(numberValue) || numberValue < (field.min ?? 0)) {
        return { ok: false, error: `Invalid numeric field: ${field.key}.` };
      }
      payload[field.key] = numberValue;
      continue;
    }
    if (typeof raw !== "string") return { ok: false, error: `Invalid field: ${field.key}.` };
    const trimmed = raw.trim();
    if (field.maxLength && trimmed.length > field.maxLength) {
      return { ok: false, error: `Field too long: ${field.key}.` };
    }
    if (field.type === "select" && !field.options?.some((option) => option.value === trimmed)) {
      return { ok: false, error: `Invalid option: ${field.key}.` };
    }
    if (["date", "datetime-local"].includes(field.type) && Number.isNaN(Date.parse(trimmed))) {
      return { ok: false, error: `Invalid date: ${field.key}.` };
    }
    if (field.key.endsWith("_id") && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
      return { ok: false, error: `Invalid reference: ${field.key}.` };
    }
    payload[field.key] = trimmed;
  }
  return { ok: true, payload };
}
