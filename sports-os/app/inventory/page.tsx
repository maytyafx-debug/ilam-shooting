"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TenantOption = { id: string; name: string; role: string };
type Warehouse = { id: string; code: string; name: string; location_label: string | null; is_active: boolean };
type Category = { id: string; name: string; sport_name: string | null };
type Item = {
  id: string; category_id: string | null; sku: string; name: string; sport_name: string | null;
  brand: string | null; model: string | null; unit: string; tracking_mode: string;
  minimum_quantity: number; is_active: boolean;
};
type Stock = { item_id: string; warehouse_id: string; quantity_on_hand: number };
type Movement = {
  id: string; item_id: string; warehouse_id: string; movement_type: string;
  quantity_delta: number; reason: string; reference_code: string | null; created_at: string;
};
type InventoryData = { warehouses: Warehouse[]; categories: Category[]; items: Item[]; stock: Stock[]; movements: Movement[] };
type Tab = "items" | "warehouses" | "categories" | "movements";
type ApiPayload = { error?: string; record?: unknown; movement_id?: string };

const STORAGE_KEY = "metatya-sports-os-active-tenant";
const EMPTY: InventoryData = { warehouses: [], categories: [], items: [], stock: [], movements: [] };
const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "items", label: "کالاها و تجهیزات", hint: "تعریف اقلام عمومی و رشته‌ای" },
  { id: "warehouses", label: "انبارها", hint: "تعریف محل‌های نگهداری" },
  { id: "categories", label: "دسته‌بندی‌ها", hint: "دسته‌بندی مستقل یا مختص رشته" },
  { id: "movements", label: "گردش موجودی", hint: "رسید، عودت، تحویل، مصرف و اصلاح" },
];

function storedTenant() {
  try { return window.sessionStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
}
function labelMovement(value: string) {
  const labels: Record<string, string> = {
    receipt: "ورود / خرید", return: "عودت به انبار", issue: "تحویل / خروج",
    consumption: "مصرف", adjustment: "اصلاح موجودی", correction: "تصحیح",
  };
  return labels[value] ?? value;
}
function fmt(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export default function InventoryPage() {
  const router = useRouter();
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [data, setData] = useState<InventoryData>(EMPTY);
  const [tab, setTab] = useState<Tab>("items");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async (organizationId: string) => {
    const response = await fetch("/api/core-sports/inventory", {
      cache: "no-store", headers: { "x-tenant-id": organizationId },
    });
    const payload = await response.json();
    if (response.status === 401) { router.replace("/login"); return; }
    if (!response.ok) throw new Error(payload.error || "بارگذاری انبار ناموفق بود.");
    setData({ ...EMPTY, ...payload });
  }, [router]);

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: authData, error } = await supabase.auth.getUser();
        if (error || !authData.user) { router.replace("/login"); return; }
        const response = await fetch("/api/core-sports/tenant", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "سازمان فعالی پیدا نشد.");
        const options = (payload.tenants ?? []) as TenantOption[];
        if (!mounted) return;
        setTenantOptions(options);
        const saved = storedTenant();
        const selected = options.length === 1 ? options[0] : options.find((item) => item.id === saved);
        if (!selected) {
          setErrorMessage(options.length ? "ابتدا سازمان فعال را انتخاب کنید." : "برای این حساب سازمان فعالی ثبت نشده است.");
          return;
        }
        if (selected.role !== "owner" && selected.role !== "admin") {
          setErrorMessage("دسترسی مدیریت انبار فقط برای مدیر سازمان مجاز است.");
          return;
        }
        setTenantId(selected.id);
        setTenantName(selected.name);
        await load(selected.id);
      } catch (error) {
        if (mounted) setErrorMessage(error instanceof Error ? error.message : "بارگذاری صفحه ناموفق بود.");
      } finally {
        if (mounted) setReady(true);
      }
    }
    void initialize();
    return () => { mounted = false; };
  }, [load, router]);

  const stockByKey = useMemo(() => new Map(
    data.stock.map((row) => [row.item_id + ":" + row.warehouse_id, Number(row.quantity_on_hand)]),
  ), [data.stock]);
  const itemById = useMemo(() => new Map(data.items.map((item) => [item.id, item])), [data.items]);
  const warehouseById = useMemo(() => new Map(data.warehouses.map((item) => [item.id, item])), [data.warehouses]);

  async function changeTenant(id: string) {
    const selected = tenantOptions.find((item) => item.id === id);
    if (!selected || (selected.role !== "owner" && selected.role !== "admin")) {
      setErrorMessage("این سازمان برای این حساب قابل مدیریت نیست.");
      return;
    }
    setBusy(true); setErrorMessage(""); setMessage(""); setData(EMPTY);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, id);
      setTenantId(id); setTenantName(selected.name);
      await load(id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "تغییر سازمان ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId) return;
    setBusy(true); setMessage(""); setErrorMessage("");
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    let payload: Record<string, unknown> = { ...raw };
    let module: string = tab;
    if (tab === "warehouses") module = "warehouse";
    if (tab === "categories") module = "category";
    if (tab === "items") {
      module = "item";
      payload.minimum_quantity = raw.minimum_quantity ? Number(raw.minimum_quantity) : 0;
      payload.category_id = raw.category_id || null;
    }
    if (tab === "movements") {
      module = "movement";
      payload.quantity = Number(raw.quantity);
    }
    try {
      const response = await fetch("/api/core-sports/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ module, data: payload }),
      });
      const result = (await response.json()) as ApiPayload;
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error(result.error || "ثبت اطلاعات ناموفق بود.");
      await load(tenantId);
      form.reset();
      setMessage(tab === "movements" ? "گردش موجودی با موفقیت ثبت شد." : "اطلاعات با موفقیت ثبت شد.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ثبت اطلاعات ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function archive(module: "item" | "warehouse", id: string) {
    if (!tenantId || !window.confirm("این رکورد غیرفعال شود؟ سوابق آن حذف نخواهد شد.")) return;
    setBusy(true); setErrorMessage(""); setMessage("");
    try {
      const response = await fetch("/api/core-sports/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ module, id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "غیرفعال‌سازی ناموفق بود.");
      await load(tenantId);
      setMessage("رکورد غیرفعال شد؛ تاریخچه و سوابق موجودی حفظ شدند.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "غیرفعال‌سازی ناموفق بود.");
    } finally { setBusy(false); }
  }

  const activeItems = data.items.filter((item) => item.is_active);
  const activeWarehouses = data.warehouses.filter((item) => item.is_active);
  const lowStock = activeItems.filter((item) => {
    const total = data.stock.filter((row) => row.item_id === item.id)
      .reduce((sum, row) => sum + Number(row.quantity_on_hand), 0);
    return Number(item.minimum_quantity) > 0 && total <= Number(item.minimum_quantity);
  });

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300">← بازگشت به داشبورد</Link>
            <p className="mt-3 text-sm font-semibold tracking-widest text-emerald-400">METATYA SPORTS OS</p>
            <h1 className="mt-1 text-3xl font-bold">مدیریت یکپارچه انبار و تجهیزات</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">هسته مشترک برای تمام رشته‌های ورزشی؛ با انبارهای مستقل هر سازمان و دسته‌بندی‌های قابل تنظیم.</p>
          </div>
          {tenantOptions.length > 1 && (
            <select aria-label="انتخاب سازمان" value={tenantId} onChange={(event) => void changeTenant(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
              <option value="">انتخاب سازمان</option>
              {tenantOptions.filter((item) => item.role === "owner" || item.role === "admin").map((item) =>
                <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
        </header>

        {tenantName && <p className="text-sm text-slate-400">سازمان فعال: <strong className="text-slate-200">{tenantName}</strong></p>}
        {message && <div role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-300">{message}</div>}
        {errorMessage && <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">{errorMessage}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["کالاهای فعال", activeItems.length],
            ["انبارهای فعال", activeWarehouses.length],
            ["دسته‌بندی‌ها", data.categories.length],
            ["اقلام در نقطه سفارش", lowStock.length],
          ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p>
          </div>)}
        </section>

        <section className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col">
            {TABS.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)}
              className={`min-w-max rounded-xl border px-4 py-3 text-right text-sm transition ${tab === item.id ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600"}`}>
              <span className="block font-semibold">{item.label}</span><span className="mt-1 block text-xs text-slate-500">{item.hint}</span>
            </button>)}
          </nav>

          <div className="space-y-5">
            <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">{TABS.find((item) => item.id === tab)?.label} · ثبت جدید</h2>
              {tab === "warehouses" && <div className="grid gap-3 sm:grid-cols-2">
                <Field name="code" label="کد انبار" required placeholder="مثلاً WH-01" />
                <Field name="name" label="نام انبار" required placeholder="انبار اصلی" />
                <Field name="location_label" label="محل نگهداری" placeholder="ساختمان یا بخش" />
              </div>}
              {tab === "categories" && <div className="grid gap-3 sm:grid-cols-2">
                <Field name="name" label="نام دسته‌بندی" required placeholder="تجهیزات تمرینی" />
                <Field name="sport_name" label="رشته ورزشی (اختیاری)" placeholder="وزنه‌برداری؛ خالی = عمومی" />
                <Field name="description" label="توضیحات" />
              </div>}
              {tab === "items" && <div className="grid gap-3 sm:grid-cols-2">
                <Field name="sku" label="کد کالا / اموال" required />
                <Field name="name" label="نام کالا یا تجهیز" required />
                <Field name="sport_name" label="رشته ورزشی (اختیاری)" placeholder="وزنه‌برداری، فوتبال، تیراندازی..." />
                <div><label className="mb-1 block text-sm text-slate-300">دسته‌بندی</label><select name="category_id" className={inputClass}><option value="">بدون دسته‌بندی</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.sport_name ? " · " + item.sport_name : ""}</option>)}</select></div>
                <Field name="brand" label="برند (اختیاری)" />
                <Field name="model" label="مدل / شناسه سازنده (اختیاری)" />
                <Field name="unit" label="واحد شمارش" required defaultValue="عدد" placeholder="عدد، جفت، کیلوگرم، بسته..." />
                <Field name="minimum_quantity" label="حداقل موجودی" type="number" defaultValue="0" min="0" step="0.001" />
                <div className="sm:col-span-2"><Field name="description" label="توضیحات" /></div>
              </div>}
              {tab === "movements" && <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="mb-1 block text-sm text-slate-300">کالا</label><select name="item_id" required className={inputClass}><option value="">انتخاب کالا</option>{activeItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}</select></div>
                <div><label className="mb-1 block text-sm text-slate-300">انبار</label><select name="warehouse_id" required className={inputClass}><option value="">انتخاب انبار</option>{activeWarehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                <div><label className="mb-1 block text-sm text-slate-300">نوع گردش</label><select name="movement_type" className={inputClass}><option value="receipt">ورود / خرید</option><option value="return">عودت به انبار</option><option value="issue">تحویل / خروج</option><option value="consumption">مصرف</option><option value="adjustment">اصلاح موجودی</option><option value="correction">تصحیح</option></select></div>
                <div><label className="mb-1 block text-sm text-slate-300">جهت اصلاح (برای اصلاح / تصحیح)</label><select name="direction" className={inputClass}><option value="increase">افزایش موجودی</option><option value="decrease">کاهش موجودی</option></select></div>
                <Field name="quantity" label="مقدار" type="number" required min="0.001" step="0.001" />
                <div className="sm:col-span-2"><Field name="reason" label="علت / توضیح گردش" required placeholder="خرید، تحویل به واحد، شمارش دوره‌ای..." /></div>
                <Field name="reference_code" label="شماره سند (اختیاری)" />
              </div>}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="submit" disabled={busy || !tenantId || !ready}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? "در حال ثبت..." : "ثبت اطلاعات"}
                </button>
                {tab === "movements" && <span className="text-xs text-slate-500">خروجی بیش از موجودی قابل ثبت نیست؛ سوابق گردش حذف یا ویرایش نمی‌شوند.</span>}
              </div>
            </form>

            {tab === "items" && <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
              <div className="border-b border-slate-800 p-4 font-semibold">فهرست کالاها و موجودی انبارها</div>
              <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-right text-sm">
                <thead className="bg-slate-950/70 text-slate-400"><tr><th className="p-3">کالا</th><th className="p-3">رشته / دسته</th><th className="p-3">کد</th><th className="p-3">موجودی به تفکیک انبار</th><th className="p-3">عملیات</th></tr></thead>
                <tbody>{data.items.map((item) => <tr key={item.id} className="border-t border-slate-800">
                  <td className="p-3"><strong>{item.name}</strong><div className="text-xs text-slate-500">{[item.brand,item.model].filter(Boolean).join(" · ") || item.unit}</div></td>
                  <td className="p-3">{item.sport_name || "عمومی"}<div className="text-xs text-slate-500">{data.categories.find((c) => c.id === item.category_id)?.name || "—"}</div></td>
                  <td className="p-3">{item.sku}</td>
                  <td className="p-3">{data.warehouses.filter((w) => w.is_active).map((w) => <div key={w.id}>{w.name}: {fmt(stockByKey.get(item.id + ":" + w.id) ?? 0)} {item.unit}</div>)}</td>
                  <td className="p-3">{item.is_active && <button type="button" disabled={busy} onClick={() => void archive("item", item.id)} className="text-xs text-rose-300 hover:text-rose-200">غیرفعال‌سازی</button>}</td>
                </tr>)}</tbody>
              </table></div>
            </div>}

            {tab === "warehouses" && <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h3 className="mb-3 font-semibold">انبارهای تعریف‌شده</h3>
              {data.warehouses.length === 0 ? <p className="text-sm text-slate-500">هنوز انباری ثبت نشده است.</p> : data.warehouses.map((w) => <div key={w.id} className="flex items-center justify-between border-t border-slate-800 py-3 text-sm"><div><strong>{w.name}</strong><span className="mr-2 text-slate-500">{w.code} · {w.location_label || "بدون محل"}</span></div>{w.is_active ? <button type="button" onClick={() => void archive("warehouse", w.id)} className="text-xs text-rose-300">غیرفعال‌سازی</button> : <span className="text-xs text-slate-500">غیرفعال</span>}</div>)}
            </div>}

            {tab === "categories" && <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h3 className="mb-3 font-semibold">دسته‌بندی‌های موجود</h3>
              {data.categories.length === 0 ? <p className="text-sm text-slate-500">هنوز دسته‌بندی ثبت نشده است.</p> : data.categories.map((c) => <div key={c.id} className="border-t border-slate-800 py-3 text-sm"><strong>{c.name}</strong><span className="mr-2 text-slate-500">{c.sport_name || "عمومی / مشترک"}</span></div>)}
            </div>}

            {tab === "movements" && <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
              <div className="border-b border-slate-800 p-4 font-semibold">آخرین گردش‌های موجودی</div>
              <div className="divide-y divide-slate-800">{data.movements.length === 0 ? <p className="p-4 text-sm text-slate-500">گردشی ثبت نشده است.</p> : data.movements.map((movement) => <div key={movement.id} className="flex flex-wrap justify-between gap-2 p-4 text-sm">
                <div><strong>{itemById.get(movement.item_id)?.name || "کالای ثبت‌شده"}</strong><p className="mt-1 text-xs text-slate-400">{warehouseById.get(movement.warehouse_id)?.name || "انبار"} · {labelMovement(movement.movement_type)} · {movement.reason}</p></div>
                <div className="text-left"><strong dir="ltr" className={movement.quantity_delta < 0 ? "text-amber-300" : "text-emerald-300"}>{movement.quantity_delta > 0 ? "+" : ""}{movement.quantity_delta}</strong><p className="text-xs text-slate-500">{new Date(movement.created_at).toLocaleString("fa-IR")}</p></div>
              </div>)}</div>
            </div>}
          </div>
        </section>
      </div>
    </main>
  );
}

const inputClass = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500";
function Field(props: { name: string; label: string; required?: boolean; placeholder?: string; type?: string; defaultValue?: string; min?: string; step?: string }) {
  return <div><label htmlFor={props.name} className="mb-1 block text-sm text-slate-300">{props.label}{props.required ? " *" : ""}</label><input id={props.name} name={props.name} required={props.required} placeholder={props.placeholder} type={props.type ?? "text"} defaultValue={props.defaultValue} min={props.min} step={props.step} className={inputClass} /></div>;
}
