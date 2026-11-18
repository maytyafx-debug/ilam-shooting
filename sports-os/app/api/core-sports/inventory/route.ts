import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCoreRole } from "@/lib/core-sports/auth";

export const runtime = "nodejs";

type Body = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MOVEMENT_TYPES = ["receipt", "return", "issue", "consumption", "adjustment", "correction"] as const;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
}
function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}
function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) return undefined;
  return value.trim() || null;
}
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
function validObject(value: unknown): value is Body {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return fail(auth.error, auth.status);

  const tenantId = auth.tenantId;
  const [warehouses, categories, items, stock, movements, transfers, assets, assetMovements] = await Promise.all([
    db.from("sports_inventory_warehouses")
      .select("id,code,name,location_label,is_active,created_at")
      .eq("tenant_id", tenantId).order("name").limit(300),
    db.from("sports_inventory_categories")
      .select("id,name,sport_name,description,created_at")
      .eq("tenant_id", tenantId).order("name").limit(500),
    db.from("sports_inventory_items")
      .select("id,category_id,sku,name,sport_name,brand,model,unit,tracking_mode,minimum_quantity,is_active,description,created_at")
      .eq("tenant_id", tenantId).order("name").limit(1000),
    db.from("sports_inventory_stock")
      .select("item_id,warehouse_id,quantity_on_hand,updated_at")
      .eq("tenant_id", tenantId).limit(5000),
    db.from("sports_inventory_movements")
      .select("id,item_id,warehouse_id,movement_type,quantity_delta,reason,reference_code,recorded_by,created_at,transfer_id")
      .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1000),
    db.from("sports_inventory_transfers")
      .select("id,item_id,from_warehouse_id,to_warehouse_id,quantity,reason,reference_code,status,created_by,created_at")
      .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1000),
    db.from("sports_inventory_assets")
      .select("id,item_id,warehouse_id,asset_code,barcode_value,serial_number,condition_status,lifecycle_status,acquired_on,notes,created_at")
      .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(3000),
    db.from("sports_inventory_asset_movements")
      .select("id,asset_id,event_type,from_warehouse_id,to_warehouse_id,notes,reference_code,recorded_by,created_at")
      .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1000),
  ]);

  const results = [warehouses, categories, items, stock, movements, transfers, assets, assetMovements];
  if (results.some((result) => result.error)) {
    console.error("[Sports OS] inventory load failed:", results.filter((result) => result.error).map((result) => result.error));
    return fail("بارگذاری اطلاعات انبار ناموفق بود.", 500);
  }

  return NextResponse.json({
    warehouses: warehouses.data ?? [],
    categories: categories.data ?? [],
    items: items.data ?? [],
    stock: stock.data ?? [],
    movements: movements.data ?? [],
    transfers: transfers.data ?? [],
    assets: assets.data ?? [],
    assetMovements: assetMovements.data ?? [],
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return fail(auth.error, auth.status);

  let body: Body;
  try { body = await request.json(); }
  catch { return fail("درخواست JSON معتبر نیست."); }
  if (!validObject(body) || !validObject(body.data) || typeof body.module !== "string") {
    return fail("ساختار اطلاعات ارسالی معتبر نیست.");
  }

  const data = body.data;
  const tenant_id = auth.tenantId;
  const created_by = auth.user.id;

  if (body.module === "warehouse") {
    const code = text(data.code, 2, 40);
    const name = text(data.name, 2, 120);
    const location_label = optionalText(data.location_label, 160);
    if (!code || !name || location_label === undefined) return fail("کد، نام یا محل انبار معتبر نیست.");
    const { data: saved, error } = await db.from("sports_inventory_warehouses")
      .insert({ tenant_id, code, name, location_label: location_label ?? null, created_by })
      .select("id,code,name,location_label,is_active,created_at").single();
    if (error) {
      console.error("[Sports OS] inventory warehouse create failed:", error);
      return fail(error.code === "23505" ? "کد این انبار قبلاً ثبت شده است." : "ثبت انبار ناموفق بود.", error.code === "23505" ? 409 : 400);
    }
    return NextResponse.json({ record: saved }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  }

  if (body.module === "category") {
    const name = text(data.name, 2, 100);
    const sport_name = optionalText(data.sport_name, 100);
    const description = optionalText(data.description, 500);
    if (!name || sport_name === undefined || description === undefined) return fail("اطلاعات دسته‌بندی معتبر نیست.");
    const { data: saved, error } = await db.from("sports_inventory_categories")
      .insert({ tenant_id, name, sport_name: sport_name ?? null, description: description ?? null, created_by })
      .select("id,name,sport_name,description,created_at").single();
    if (error) {
      console.error("[Sports OS] inventory category create failed:", error);
      return fail(error.code === "23505" ? "این دسته‌بندی برای این رشته قبلاً ثبت شده است." : "ثبت دسته‌بندی ناموفق بود.", error.code === "23505" ? 409 : 400);
    }
    return NextResponse.json({ record: saved }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  }

  if (body.module === "item") {
    const sku = text(data.sku, 2, 60);
    const name = text(data.name, 2, 160);
    const sport_name = optionalText(data.sport_name, 100);
    const brand = optionalText(data.brand, 100);
    const model = optionalText(data.model, 100);
    const description = optionalText(data.description, 1000);
    const unit = text(data.unit ?? "عدد", 1, 24);
    const tracking_mode = data.tracking_mode ?? "quantity";
    if (tracking_mode !== "quantity" && tracking_mode !== "individual") return fail("روش ردیابی کالا معتبر نیست.");
    const minimum_quantity = Number(data.minimum_quantity ?? 0);
    const category_id = data.category_id == null || data.category_id === "" ? null : data.category_id;
    if (!sku || !name || sport_name === undefined || brand === undefined || model === undefined ||
        description === undefined || !unit ||
        !Number.isFinite(minimum_quantity) || minimum_quantity < 0 || minimum_quantity > 1000000000 ||
        (category_id !== null && !isUuid(category_id))) return fail("مشخصات کالا معتبر نیست.");
    const { data: saved, error } = await db.from("sports_inventory_items")
      .insert({
        tenant_id, category_id, sku, name, sport_name: sport_name ?? null,
        brand: brand ?? null, model: model ?? null, unit, tracking_mode,
        minimum_quantity, description: description ?? null, created_by,
      })
      .select("id,category_id,sku,name,sport_name,brand,model,unit,tracking_mode,minimum_quantity,is_active,description,created_at")
      .single();
    if (error) {
      console.error("[Sports OS] inventory item create failed:", error);
      return fail(error.code === "23505" ? "کد کالا قبلاً در این سازمان ثبت شده است." : "ثبت کالا ناموفق بود.", error.code === "23505" ? 409 : 400);
    }
    return NextResponse.json({ record: saved }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  }

  if (body.module === "asset") {
    const item_id = data.item_id;
    const warehouse_id = data.warehouse_id;
    const asset_code = optionalText(data.asset_code, 80);
    const serial_number = optionalText(data.serial_number, 120);
    const notes = text(data.notes ?? "ثبت اولیه دارایی", 2, 500);
    const condition_status = data.condition_status ?? "good";
    const acquired_on = optionalText(data.acquired_on, 10);
    if (!isUuid(item_id) || !isUuid(warehouse_id) || asset_code === undefined ||
        serial_number === undefined || !notes ||
        !["new", "good", "fair", "damaged"].includes(String(condition_status)) ||
        (acquired_on !== undefined && acquired_on !== null && !/^\\d{4}-\\d{2}-\\d{2}$/.test(acquired_on))) {
      return fail("مشخصات دارایی مستقل معتبر نیست.");
    }
    const { data: registered, error } = await db.rpc("sports_inventory_register_asset", {
      p_tenant_id: tenant_id, p_item_id: item_id, p_warehouse_id: warehouse_id,
      p_asset_code: asset_code ?? null, p_serial_number: serial_number ?? null,
      p_condition_status: condition_status, p_acquired_on: acquired_on ?? null, p_notes: notes,
    });
    if (error || !registered) {
      console.error("[Sports OS] asset registration failed:", error);
      return fail(error?.code === "23505" ? "کد اموال تکراری است." : "ثبت دارایی مستقل ناموفق بود.", error?.code === "23505" ? 409 : 400);
    }
    const asset = Array.isArray(registered) ? registered[0] : registered;
    return NextResponse.json({ asset }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  }

  if (body.module === "asset_transfer") {
    const asset_id = data.asset_id;
    const to_warehouse_id = data.to_warehouse_id;
    const reason = text(data.reason, 2, 500);
    const reference_code = optionalText(data.reference_code, 100);
    if (!isUuid(asset_id) || !isUuid(to_warehouse_id) || !reason || reference_code === undefined) {
      return fail("اطلاعات انتقال دارایی معتبر نیست.");
    }
    const { data: eventId, error } = await db.rpc("sports_inventory_transfer_asset", {
      p_tenant_id: tenant_id, p_asset_id: asset_id,
      p_to_warehouse_id: to_warehouse_id, p_reason: reason,
      p_reference_code: reference_code ?? null,
    });
    if (error || !eventId) {
      console.error("[Sports OS] asset transfer failed:", error);
      return fail("انتقال دارایی ناموفق بود.", 400);
    }
    return NextResponse.json({ asset_movement_id: eventId }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  }

  if (body.module === "transfer") {
    const item_id = data.item_id;
    const from_warehouse_id = data.from_warehouse_id;
    const to_warehouse_id = data.to_warehouse_id;
    const quantity = Number(data.quantity);
    const reason = text(data.reason, 2, 500);
    const reference_code = optionalText(data.reference_code, 100);
    if (!isUuid(item_id) || !isUuid(from_warehouse_id) || !isUuid(to_warehouse_id) ||
        from_warehouse_id === to_warehouse_id || !Number.isFinite(quantity) || quantity <= 0 ||
        quantity > 1000000000 || !reason || reference_code === undefined) {
      return fail("اطلاعات انتقال بین انبارها معتبر نیست.");
    }
    const { data: transferId, error } = await db.rpc("sports_inventory_transfer_stock", {
      p_tenant_id: tenant_id, p_item_id: item_id,
      p_from_warehouse_id: from_warehouse_id, p_to_warehouse_id: to_warehouse_id,
      p_quantity: quantity, p_reason: reason, p_reference_code: reference_code ?? null,
    });
    if (error || !transferId) {
      console.error("[Sports OS] stock transfer failed:", error);
      const insufficient = error?.code === "23514";
      return fail(insufficient ? "موجودی انبار مبدأ کافی نیست." : "انتقال موجودی ناموفق بود.", insufficient ? 409 : 400);
    }
    return NextResponse.json({ transfer_id: transferId }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  }

  if (body.module === "movement") {
    const item_id = data.item_id;
    const warehouse_id = data.warehouse_id;
    const movementType = data.movement_type;
    const reason = text(data.reason, 2, 500);
    const reference_code = optionalText(data.reference_code, 100);
    const quantity = Number(data.quantity);
    if (!isUuid(item_id) || !isUuid(warehouse_id) ||
        typeof movementType !== "string" || !MOVEMENT_TYPES.includes(movementType as typeof MOVEMENT_TYPES[number]) ||
        !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000000 ||
        !reason || reference_code === undefined) return fail("اطلاعات گردش موجودی معتبر نیست.");
    const direction = data.direction ?? "increase";
    if (!["increase", "decrease"].includes(String(direction))) return fail("جهت اصلاح موجودی معتبر نیست.");
    if (["adjustment", "correction"].includes(movementType)) {
      // Adjustments may increase or decrease the counted balance.
    } else if (direction !== "increase") {
      return fail("جهت این نوع گردش از نوع عملیات مشخص می‌شود.");
    }
    const quantity_delta = ["issue", "consumption"].includes(String(movementType)) ||
      (["adjustment", "correction"].includes(String(movementType)) && direction === "decrease")
      ? -quantity : quantity;
    const { data: movementId, error } = await db.rpc("sports_inventory_record_movement", {
      p_tenant_id: tenant_id,
      p_item_id: item_id,
      p_warehouse_id: warehouse_id,
      p_movement_type: movementType,
      p_quantity_delta: quantity_delta,
      p_reason: reason,
      p_reference_code: reference_code ?? null,
    });
    if (error || !movementId) {
      console.error("[Sports OS] inventory movement failed:", error);
      const insufficient = error?.code === "23514";
      return fail(insufficient ? "موجودی کافی برای این خروج یا اصلاح وجود ندارد." : "ثبت گردش موجودی ناموفق بود.", insufficient ? 409 : 400);
    }
    return NextResponse.json({ movement_id: movementId }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  }

  return fail("نوع عملیات انبار پشتیبانی نمی‌شود.");
}

export async function PATCH(request: NextRequest) {
  const db = await createSupabaseServerClient();
  const auth = await requireCoreRole(db, ["admin"], request.headers.get("x-tenant-id"));
  if (!auth.ok) return fail(auth.error, auth.status);

  let body: Body;
  try { body = await request.json(); }
  catch { return fail("درخواست JSON معتبر نیست."); }
  if (!validObject(body) || !isUuid(body.id) || !["item", "warehouse"].includes(String(body.module))) {
    return fail("اطلاعات غیرفعال‌سازی معتبر نیست.");
  }

  const table = body.module === "item" ? "sports_inventory_items" : "sports_inventory_warehouses";
  const { data, error } = await db.from(table).update({ is_active: false })
    .eq("id", body.id).eq("tenant_id", auth.tenantId).eq("is_active", true)
    .select("id,is_active").maybeSingle();
  if (error || !data) {
    console.error("[Sports OS] inventory archive failed:", error);
    return fail("رکورد پیدا نشد یا غیرفعال‌سازی آن ممکن نیست.", 404);
  }
  return NextResponse.json({ record: data }, { headers: { "Cache-Control": "private, no-store" } });
}
