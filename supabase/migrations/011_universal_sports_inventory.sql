-- METATYA Sports OS: discipline-neutral inventory and asset-stock foundation.
-- Additive only. No existing records are modified and no live database is touched.
-- All records are tenant-scoped; stock changes are append-only movements through
-- a transactional RPC that locks the balance row before applying a quantity delta.

BEGIN;

CREATE TABLE IF NOT EXISTS public.sports_inventory_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (length(trim(code)) BETWEEN 2 AND 40),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  location_label text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.sports_inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
  sport_name text,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  UNIQUE NULLS NOT DISTINCT (tenant_id, name, sport_name)
);

CREATE TABLE IF NOT EXISTS public.sports_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id) ON DELETE CASCADE,
  category_id uuid,
  sku text NOT NULL CHECK (length(trim(sku)) BETWEEN 2 AND 60),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  sport_name text,
  brand text,
  model text,
  unit text NOT NULL DEFAULT 'عدد' CHECK (length(trim(unit)) BETWEEN 1 AND 24),
  tracking_mode text NOT NULL DEFAULT 'quantity' CHECK (tracking_mode IN ('quantity','individual')),
  minimum_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (minimum_quantity >= 0),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, sku),
  FOREIGN KEY (category_id, tenant_id)
    REFERENCES public.sports_inventory_categories(id, tenant_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.sports_inventory_stock (
  tenant_id uuid NOT NULL,
  item_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  quantity_on_hand numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, item_id, warehouse_id),
  FOREIGN KEY (item_id, tenant_id)
    REFERENCES public.sports_inventory_items(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (warehouse_id, tenant_id)
    REFERENCES public.sports_inventory_warehouses(id, tenant_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.sports_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  item_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('receipt','return','issue','consumption','adjustment','correction')),
  quantity_delta numeric(14,3) NOT NULL CHECK (quantity_delta <> 0),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 2 AND 500),
  reference_code text,
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (item_id, tenant_id)
    REFERENCES public.sports_inventory_items(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (warehouse_id, tenant_id)
    REFERENCES public.sports_inventory_warehouses(id, tenant_id) ON DELETE RESTRICT,
  CHECK (
    (movement_type IN ('receipt','return') AND quantity_delta > 0)
    OR (movement_type IN ('issue','consumption') AND quantity_delta < 0)
    OR movement_type IN ('adjustment','correction')
  )
);

CREATE INDEX IF NOT EXISTS sports_inventory_items_tenant_name_idx
  ON public.sports_inventory_items(tenant_id, is_active, name);
CREATE INDEX IF NOT EXISTS sports_inventory_stock_tenant_warehouse_idx
  ON public.sports_inventory_stock(tenant_id, warehouse_id, item_id);
CREATE INDEX IF NOT EXISTS sports_inventory_movements_tenant_created_idx
  ON public.sports_inventory_movements(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sports_inventory_movements_item_idx
  ON public.sports_inventory_movements(tenant_id, item_id, warehouse_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.sports_inventory_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sports_inventory_warehouses_updated_at ON public.sports_inventory_warehouses;
CREATE TRIGGER sports_inventory_warehouses_updated_at
BEFORE UPDATE ON public.sports_inventory_warehouses
FOR EACH ROW EXECUTE FUNCTION public.sports_inventory_set_updated_at();

DROP TRIGGER IF EXISTS sports_inventory_items_updated_at ON public.sports_inventory_items;
CREATE TRIGGER sports_inventory_items_updated_at
BEFORE UPDATE ON public.sports_inventory_items
FOR EACH ROW EXECUTE FUNCTION public.sports_inventory_set_updated_at();

CREATE OR REPLACE FUNCTION public.sports_inventory_record_movement(
  p_tenant_id uuid,
  p_item_id uuid,
  p_warehouse_id uuid,
  p_movement_type text,
  p_quantity_delta numeric,
  p_reason text,
  p_reference_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_balance numeric(14,3);
  v_movement_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authenticated actor required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships m
    WHERE m.tenant_id = p_tenant_id
      AND m.user_id = v_actor
      AND m.status = 'active'
      AND m.role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'Inventory administrator role required' USING ERRCODE = '42501';
  END IF;

  IF p_quantity_delta IS NULL OR p_quantity_delta = 0
     OR abs(p_quantity_delta) > 1000000000
     OR p_movement_type NOT IN ('receipt','return','issue','consumption','adjustment','correction')
     OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'Invalid inventory movement' USING ERRCODE = '22023';
  END IF;

  IF (p_movement_type IN ('receipt','return') AND p_quantity_delta < 0)
     OR (p_movement_type IN ('issue','consumption') AND p_quantity_delta > 0) THEN
    RAISE EXCEPTION 'Movement direction does not match movement type' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sports_inventory_items i
    WHERE i.id = p_item_id AND i.tenant_id = p_tenant_id AND i.is_active
  ) OR NOT EXISTS (
    SELECT 1 FROM public.sports_inventory_warehouses w
    WHERE w.id = p_warehouse_id AND w.tenant_id = p_tenant_id AND w.is_active
  ) THEN
    RAISE EXCEPTION 'Active item and warehouse in the selected organization are required' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.sports_inventory_stock(tenant_id,item_id,warehouse_id,quantity_on_hand)
  VALUES (p_tenant_id,p_item_id,p_warehouse_id,0)
  ON CONFLICT (tenant_id,item_id,warehouse_id) DO NOTHING;

  SELECT quantity_on_hand INTO v_balance
  FROM public.sports_inventory_stock
  WHERE tenant_id=p_tenant_id AND item_id=p_item_id AND warehouse_id=p_warehouse_id
  FOR UPDATE;

  IF v_balance + p_quantity_delta < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for this movement' USING ERRCODE = '23514';
  END IF;

  UPDATE public.sports_inventory_stock
  SET quantity_on_hand = v_balance + p_quantity_delta, updated_at = now()
  WHERE tenant_id=p_tenant_id AND item_id=p_item_id AND warehouse_id=p_warehouse_id;

  INSERT INTO public.sports_inventory_movements(
    tenant_id,item_id,warehouse_id,movement_type,quantity_delta,reason,reference_code,recorded_by
  ) VALUES (
    p_tenant_id,p_item_id,p_warehouse_id,p_movement_type,p_quantity_delta,
    trim(p_reason),nullif(trim(p_reference_code),''),v_actor
  ) RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sports_inventory_record_movement(uuid,uuid,uuid,text,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sports_inventory_record_movement(uuid,uuid,uuid,text,numeric,text,text) TO authenticated;

-- Inventory movement history is append-only. Corrections are new movements.
CREATE OR REPLACE FUNCTION public.sports_inventory_prevent_movement_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Inventory movement history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS sports_inventory_movements_immutable ON public.sports_inventory_movements;
CREATE TRIGGER sports_inventory_movements_immutable
BEFORE UPDATE OR DELETE ON public.sports_inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.sports_inventory_prevent_movement_mutation();

ALTER TABLE public.sports_inventory_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_inventory_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.sports_inventory_warehouses,
  public.sports_inventory_categories,
  public.sports_inventory_items,
  public.sports_inventory_stock,
  public.sports_inventory_movements
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.sports_inventory_warehouses,
  public.sports_inventory_categories,
  public.sports_inventory_items
TO authenticated;

GRANT SELECT ON TABLE
  public.sports_inventory_stock,
  public.sports_inventory_movements
TO authenticated;

CREATE POLICY sports_inventory_warehouses_admin_all
ON public.sports_inventory_warehouses FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sports_tenant_memberships m
  WHERE m.tenant_id=sports_inventory_warehouses.tenant_id
    AND m.user_id=(SELECT auth.uid()) AND m.status='active' AND m.role IN ('owner','admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sports_tenant_memberships m
  WHERE m.tenant_id=sports_inventory_warehouses.tenant_id
    AND m.user_id=(SELECT auth.uid()) AND m.status='active' AND m.role IN ('owner','admin')
));

CREATE POLICY sports_inventory_categories_admin_all
ON public.sports_inventory_categories FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sports_tenant_memberships m
  WHERE m.tenant_id=sports_inventory_categories.tenant_id
    AND m.user_id=(SELECT auth.uid()) AND m.status='active' AND m.role IN ('owner','admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sports_tenant_memberships m
  WHERE m.tenant_id=sports_inventory_categories.tenant_id
    AND m.user_id=(SELECT auth.uid()) AND m.status='active' AND m.role IN ('owner','admin')
));

CREATE POLICY sports_inventory_items_admin_all
ON public.sports_inventory_items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sports_tenant_memberships m
  WHERE m.tenant_id=sports_inventory_items.tenant_id
    AND m.user_id=(SELECT auth.uid()) AND m.status='active' AND m.role IN ('owner','admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sports_tenant_memberships m
  WHERE m.tenant_id=sports_inventory_items.tenant_id
    AND m.user_id=(SELECT auth.uid()) AND m.status='active' AND m.role IN ('owner','admin')
));

CREATE POLICY sports_inventory_stock_admin_read
ON public.sports_inventory_stock FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sports_tenant_memberships m
  WHERE m.tenant_id=sports_inventory_stock.tenant_id
    AND m.user_id=(SELECT auth.uid()) AND m.status='active' AND m.role IN ('owner','admin')
));

CREATE POLICY sports_inventory_movements_admin_read
ON public.sports_inventory_movements FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sports_tenant_memberships m
  WHERE m.tenant_id=sports_inventory_movements.tenant_id
    AND m.user_id=(SELECT auth.uid()) AND m.status='active' AND m.role IN ('owner','admin')
));

COMMIT;
