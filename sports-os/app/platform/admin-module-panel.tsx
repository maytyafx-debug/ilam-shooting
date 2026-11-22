"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_MODULES, type AdminField } from "@/lib/core-sports/admin-records";

type AdminRecord = {
  id: string;
  title: string;
  payload: Record<string, string | number>;
  status: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  moduleId: string;
  tenantId: string;
  role: string;
  onSchemaReady?: () => void;
};

export default function AdminModulePanel({ moduleId, tenantId, role, onSchemaReady }: Props) {
  const router = useRouter();
  const module = ADMIN_MODULES[moduleId];
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fields = useMemo(() => module?.fields ?? [], [module]);

  async function loadRecords() {
    if (!module || !tenantId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/core-sports/admin-records?type=${encodeURIComponent(module.recordType)}&limit=100`,
        { cache: "no-store", headers: { "x-tenant-id": tenantId } },
      );
      const payload = await response.json();
      if (response.status === 401) { router.replace("/login"); return; }
      if (response.status === 428) { router.replace("/security/mfa"); return; }
      if (response.status === 503 && payload.error === "ADMIN_SCHEMA_NOT_APPLIED") {
        setUnavailable(true);
        setRecords([]);
        return;
      }
      if (!response.ok) throw new Error(payload.error || "دریافت اطلاعات این بخش ناموفق بود.");
      setUnavailable(false);
      setRecords(payload.records ?? []);
      onSchemaReady?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "خطا در دریافت اطلاعات.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
    // loadRecords is intentionally scoped to the active module and tenant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module?.recordType, tenantId]);

  function fieldValue(field: AdminField) {
    return draft[field.key] ?? "";
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!module) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload: Record<string, string | number> = {};
      for (const field of fields) {
        const value = fieldValue(field);
        if (value === "") continue;
        payload[field.key] = field.type === "number" ? Number(value) : value;
      }
      const response = await fetch("/api/core-sports/admin-records", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ record_type: module.recordType, title, payload }),
      });
      const result = await response.json();
      if (response.status === 401) { router.replace("/login"); return; }
      if (response.status === 428) { router.replace("/security/mfa"); return; }
      if (response.status === 503 && result.error === "ADMIN_SCHEMA_NOT_APPLIED") {
        setUnavailable(true);
        throw new Error("ساختار داده این بخش هنوز در پایگاه داده فعال نشده است.");
      }
      if (!response.ok) throw new Error(result.error || "ذخیره اطلاعات انجام نشد.");
      setTitle("");
      setDraft({});
      setNotice("رکورد با موفقیت ذخیره شد.");
      await loadRecords();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ذخیره اطلاعات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveRecord(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/core-sports/admin-records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ status: "archived" }),
      });
      const result = await response.json();
      if (response.status === 401) { router.replace("/login"); return; }
      if (response.status === 428) { router.replace("/security/mfa"); return; }
      if (!response.ok) throw new Error(result.error || "بایگانی رکورد ناموفق بود.");
      setNotice("رکورد بایگانی شد.");
      await loadRecords();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "بایگانی ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  if (!module) {
    return <section className="content-panel"><h2>این بخش به سرویس اختصاصی نیاز دارد</h2><p>این قسمت از مسیر ثبت عمومی جدا نگه داشته شده و تا تکمیل کنترل‌های تخصصی فعال نمی‌شود.</p></section>;
  }

  if (role !== "owner" && role !== "admin") {
    return <section className="content-panel"><h2>{module.title}</h2><p>برای مشاهده و مدیریت این اطلاعات، دسترسی مدیریتی تأییدشده لازم است.</p></section>;
  }

  return (
    <section className="content-panel admin-module-panel">
      <div className="section-heading">
        <div><span className="eyebrow">ADMINISTRATIVE RECORDS</span><h2>{module.title}</h2></div>
        <span className={unavailable ? "planned-pill" : "connected-pill"}>
          {unavailable ? "ساختار داده هنوز فعال نیست" : "اتصال سرویس بررسی شد"}
        </span>
      </div>

      {unavailable && <div className="platform-alert error" role="status">
        ساختار داده و ممیزی این ماژول در طرح مهاجرت مخزن ثبت شده، اما هنوز روی پایگاه داده اعمال نشده است. تا آن زمان امکان ثبت واقعی وجود ندارد.
      </div>}
      {error && <div className="platform-alert error" role="alert">{error}</div>}
      {notice && <div className="platform-alert success" role="status">{notice}</div>}

      {!unavailable && <form className="admin-record-form" onSubmit={createRecord}>
        <label className="admin-record-title">عنوان پرونده
          <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={2} maxLength={180} required />
        </label>
        <div className="admin-record-fields">
          {fields.map((field) => <label key={field.key}>
            {field.label}
            {field.type === "select" ? <select value={fieldValue(field)} onChange={(event) => setDraft((old) => ({ ...old, [field.key]: event.target.value }))} required={field.required}>
              <option value="">انتخاب کنید</option>
              {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select> : <input
              type={field.type === "datetime-local" ? "datetime-local" : field.type}
              value={fieldValue(field)}
              min={field.min}
              maxLength={field.maxLength}
              required={field.required}
              onChange={(event) => setDraft((old) => ({ ...old, [field.key]: event.target.value }))}
            />}
          </label>)}
        </div>
        <button type="submit" disabled={busy || unavailable}>{busy ? "در حال ذخیره…" : "ثبت پرونده"}</button>
      </form>}

      <div className="section-heading admin-record-list-heading">
        <div><span className="eyebrow">TENANT RECORDS</span><h3>پرونده‌های ثبت‌شده</h3></div>
        <button type="button" className="secondary-action" onClick={() => void loadRecords()} disabled={loading || busy}>به‌روزرسانی</button>
      </div>

      {loading ? <p className="empty-copy">در حال دریافت اطلاعات…</p> :
        unavailable ? <p className="empty-copy">پس از فعال‌شدن ساختار داده، فهرست این بخش در همین صفحه نمایش داده می‌شود.</p> :
        records.length === 0 ? <p className="empty-copy">هنوز پرونده‌ای در این بخش ثبت نشده است.</p> :
        <div className="platform-table-wrap"><table className="platform-table">
          <thead><tr><th>عنوان</th><th>وضعیت</th><th>آخرین تغییر</th><th>عملیات</th></tr></thead>
          <tbody>{records.map((record) => <tr key={record.id}>
            <td><b>{record.title}</b><small className="admin-record-meta">{Object.entries(record.payload).map(([key, value]) => `${key}: ${value}`).join(" · ")}</small></td>
            <td>{record.status}</td>
            <td>{new Date(record.updated_at).toLocaleDateString("fa-IR")}</td>
            <td>{record.status !== "archived" && <button type="button" className="secondary-action" onClick={() => void archiveRecord(record.id)} disabled={busy}>بایگانی</button>}</td>
          </tr>)}</tbody>
        </table></div>
      }
      <p className="privacy-hint">این بخش فقط فراداده اداری را نگهداری می‌کند. مدارک هویتی، اطلاعات پزشکی، اطلاعات پرداخت و فایل‌های محرمانه در این نسخه بارگذاری نمی‌شوند.</p>
    </section>
  );
}
