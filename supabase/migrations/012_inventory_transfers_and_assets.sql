-- METATYA Sports OS: atomic stock transfers, individually tracked assets and QR/barcode identifiers.
-- Additive migration. No existing inventory records are rewritten.
BEGIN;

ALTER TABLE public.sports_inventory_movements
  ADD COLUMN IF NOT EXISTS transfer_id uuid;

ALTER TABLE public.sports_inventory_movements
  DROP CONSTRAINT IF EXISTS sports_inventory_movements_movement_type_check;
ALTER TABLE public.sports_inventory_movements
  ADD CONSTRAINT sports_inventory_movements_movement_type_check
  CHECK (movement_type IN ('receipt','return','issue','consumption','adjustment','correction','transfer_in','transfer_out'));

CREATE TABLE IF NOT EXISTS public.sports_inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  from_warehouse_id uuid NOT NULL,
  to_warehouse_id uuid NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 2 AND 500),
  reference_code text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_warehouse_id <> to_warehouse_id),
  FOREIGN KEY (item_id,tenant_id) REFERENCES public.sports_inventory_items(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (from_warehouse_id,tenant_id) REFERENCES public.sports_inventory_warehouses(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (to_warehouse_id,tenant_id) REFERENCES public.sports_inventory_warehouses(id,tenant_id) ON DELETE RESTRICT,
  UNIQUE (id,tenant_id)
);

ALTER TABLE public.sports_inventory_movements
  DROP CONSTRAINT IF EXISTS sports_inventory_movements_check;
ALTER TABLE public.sports_inventory_movements
  ADD CONSTRAINT sports_inventory_movements_direction_check
  CHECK (
    (movement_type IN ('receipt','return','transfer_in') AND quantity_delta > 0)
    OR (movement_type IN ('issue','consumption','transfer_out') AND quantity_delta < 0)
    OR movement_type IN ('adjustment','correction')
  );

ALTER TABLE public.sports_inventory_movements
  ADD CONSTRAINT sports_inventory_movements_transfer_fk
  FOREIGN KEY (transfer_id,tenant_id)
  REFERENCES public.sports_inventory_transfers(id,tenant_id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS sports_inventory_transfers_tenant_created_idx
  ON public.sports_inventory_transfers(tenant_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.sports_inventory_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.sports_tenants(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  asset_code text NOT NULL CHECK (length(trim(asset_code)) BETWEEN 3 AND 80),
  barcode_value text NOT NULL CHECK (length(trim(barcode_value)) BETWEEN 3 AND 120),
  serial_number text,
  condition_status text NOT NULL DEFAULT 'good' CHECK (condition_status IN ('new','good','fair','damaged')),
  lifecycle_status text NOT NULL DEFAULT 'available' CHECK (lifecycle_status IN ('available','issued','maintenance','retired','lost')),
  acquired_on date,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,tenant_id),
  UNIQUE (tenant_id,asset_code),
  UNIQUE (tenant_id,barcode_value),
  FOREIGN KEY (item_id,tenant_id) REFERENCES public.sports_inventory_items(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (warehouse_id,tenant_id) REFERENCES public.sports_inventory_warehouses(id,tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS sports_inventory_assets_tenant_item_idx
  ON public.sports_inventory_assets(tenant_id,item_id,lifecycle_status);
CREATE INDEX IF NOT EXISTS sports_inventory_assets_tenant_warehouse_idx
  ON public.sports_inventory_assets(tenant_id,warehouse_id,lifecycle_status);

CREATE TABLE IF NOT EXISTS public.sports_inventory_asset_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('receipt','transfer','issue','return','maintenance','condition_change','retire','mark_lost')),
  from_warehouse_id uuid,
  to_warehouse_id uuid,
  notes text NOT NULL CHECK (length(trim(notes)) BETWEEN 2 AND 500),
  reference_code text,
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (asset_id,tenant_id) REFERENCES public.sports_inventory_assets(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (from_warehouse_id,tenant_id) REFERENCES public.sports_inventory_warehouses(id,tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (to_warehouse_id,tenant_id) REFERENCES public.sports_inventory_warehouses(id,tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS sports_inventory_asset_movements_tenant_created_idx
  ON public.sports_inventory_asset_movements(tenant_id,created_at DESC);

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
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships m
    WHERE m.tenant_id=p_tenant_id AND m.user_id=v_actor
      AND m.status='active' AND m.role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'Inventory administrator role required' USING ERRCODE='42501';
  END IF;
  IF p_quantity_delta IS NULL OR p_quantity_delta=0
     OR abs(p_quantity_delta)>1000000000
     OR p_movement_type NOT IN ('receipt','return','issue','consumption','adjustment','correction')
     OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'Invalid inventory movement' USING ERRCODE='22023';
  END IF;
  IF (p_movement_type IN ('receipt','return') AND p_quantity_delta<0)
     OR (p_movement_type IN ('issue','consumption') AND p_quantity_delta>0) THEN
    RAISE EXCEPTION 'Movement direction does not match movement type' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sports_inventory_items i
    WHERE i.id=p_item_id AND i.tenant_id=p_tenant_id AND i.is_active
      AND i.tracking_mode='quantity'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.sports_inventory_warehouses w
    WHERE w.id=p_warehouse_id AND w.tenant_id=p_tenant_id AND w.is_active
  ) THEN
    RAISE EXCEPTION 'Active quantity item and warehouse in the selected organization are required' USING ERRCODE='23503';
  END IF;
  INSERT INTO public.sports_inventory_stock(tenant_id,item_id,warehouse_id,quantity_on_hand)
  VALUES (p_tenant_id,p_item_id,p_warehouse_id,0)
  ON CONFLICT (tenant_id,item_id,warehouse_id) DO NOTHING;
  SELECT quantity_on_hand INTO v_balance
  FROM public.sports_inventory_stock
  WHERE tenant_id=p_tenant_id AND item_id=p_item_id AND warehouse_id=p_warehouse_id
  FOR UPDATE;
  IF v_balance+p_quantity_delta<0 THEN
    RAISE EXCEPTION 'Insufficient stock for this movement' USING ERRCODE='23514';
  END IF;
  UPDATE public.sports_inventory_stock
  SET quantity_on_hand=v_balance+p_quantity_delta,updated_at=now()
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

CREATE OR REPLACE FUNCTION public.sports_inventory_transfer_stock(
  p_tenant_id uuid,
  p_item_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_quantity numeric,
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
  v_source numeric(14,3);
  v_transfer_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships m
    WHERE m.tenant_id=p_tenant_id AND m.user_id=v_actor
      AND m.status='active' AND m.role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'Inventory administrator role required' USING ERRCODE='42501';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 1000000000
     OR p_from_warehouse_id = p_to_warehouse_id
     OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'Invalid inventory transfer' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sports_inventory_items i
    WHERE i.id=p_item_id AND i.tenant_id=p_tenant_id
      AND i.is_active AND i.tracking_mode='quantity'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.sports_inventory_warehouses w
    WHERE w.id=p_from_warehouse_id AND w.tenant_id=p_tenant_id AND w.is_active
  ) OR NOT EXISTS (
    SELECT 1 FROM public.sports_inventory_warehouses w
    WHERE w.id=p_to_warehouse_id AND w.tenant_id=p_tenant_id AND w.is_active
  ) THEN
    RAISE EXCEPTION 'Active quantity item and warehouses in the same organization are required' USING ERRCODE='23503';
  END IF;

  INSERT INTO public.sports_inventory_stock(tenant_id,item_id,warehouse_id,quantity_on_hand)
  VALUES (p_tenant_id,p_item_id,p_from_warehouse_id,0),
         (p_tenant_id,p_item_id,p_to_warehouse_id,0)
  ON CONFLICT (tenant_id,item_id,warehouse_id) DO NOTHING;

  PERFORM 1 FROM public.sports_inventory_stock s
  WHERE s.tenant_id=p_tenant_id AND s.item_id=p_item_id
    AND s.warehouse_id IN (p_from_warehouse_id,p_to_warehouse_id)
  ORDER BY s.warehouse_id
  FOR UPDATE;

  SELECT quantity_on_hand INTO v_source
  FROM public.sports_inventory_stock
  WHERE tenant_id=p_tenant_id AND item_id=p_item_id AND warehouse_id=p_from_warehouse_id;
  IF v_source < p_quantity THEN
    RAISE EXCEPTION 'Insufficient source warehouse stock' USING ERRCODE='23514';
  END IF;

  INSERT INTO public.sports_inventory_transfers(
    tenant_id,item_id,from_warehouse_id,to_warehouse_id,quantity,reason,reference_code,created_by
  ) VALUES (
    p_tenant_id,p_item_id,p_from_warehouse_id,p_to_warehouse_id,p_quantity,
    trim(p_reason),nullif(trim(p_reference_code),''),v_actor
  ) RETURNING id INTO v_transfer_id;

  UPDATE public.sports_inventory_stock
  SET quantity_on_hand=quantity_on_hand-p_quantity,updated_at=now()
  WHERE tenant_id=p_tenant_id AND item_id=p_item_id AND warehouse_id=p_from_warehouse_id;
  UPDATE public.sports_inventory_stock
  SET quantity_on_hand=quantity_on_hand+p_quantity,updated_at=now()
  WHERE tenant_id=p_tenant_id AND item_id=p_item_id AND warehouse_id=p_to_warehouse_id;

  INSERT INTO public.sports_inventory_movements(
    tenant_id,item_id,warehouse_id,movement_type,quantity_delta,reason,reference_code,recorded_by,transfer_id
  ) VALUES
    (p_tenant_id,p_item_id,p_from_warehouse_id,'transfer_out',-p_quantity,trim(p_reason),nullif(trim(p_reference_code),''),v_actor,v_transfer_id),
    (p_tenant_id,p_item_id,p_to_warehouse_id,'transfer_in',p_quantity,trim(p_reason),nullif(trim(p_reference_code),''),v_actor,v_transfer_id);

  RETURN v_transfer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sports_inventory_register_asset(
  p_tenant_id uuid,
  p_item_id uuid,
  p_warehouse_id uuid,
  p_asset_code text DEFAULT NULL,
  p_serial_number text DEFAULT NULL,
  p_condition_status text DEFAULT 'good',
  p_acquired_on date DEFAULT NULL,
  p_notes text DEFAULT 'ثبت اولیه دارایی'
)
RETURNS TABLE(asset_id uuid, asset_code text, barcode_value text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_code text := coalesce(nullif(trim(p_asset_code),''),'AST-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
  v_barcode text;
  v_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships m
    WHERE m.tenant_id=p_tenant_id AND m.user_id=v_actor
      AND m.status='active' AND m.role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'Inventory administrator role required' USING ERRCODE='42501';
  END IF;
  IF length(v_code) NOT BETWEEN 3 AND 80
     OR p_condition_status NOT IN ('new','good','fair','damaged')
     OR p_notes IS NULL OR length(trim(p_notes)) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'Invalid asset registration' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sports_inventory_items i
    WHERE i.id=p_item_id AND i.tenant_id=p_tenant_id AND i.is_active AND i.tracking_mode='individual'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.sports_inventory_warehouses w
    WHERE w.id=p_warehouse_id AND w.tenant_id=p_tenant_id AND w.is_active
  ) THEN
    RAISE EXCEPTION 'Individual asset item and active warehouse are required' USING ERRCODE='23503';
  END IF;

  v_barcode := v_code;
  INSERT INTO public.sports_inventory_assets(
    tenant_id,item_id,warehouse_id,asset_code,barcode_value,serial_number,
    condition_status,acquired_on,notes,created_by
  ) VALUES (
    p_tenant_id,p_item_id,p_warehouse_id,v_code,v_barcode,
    nullif(trim(p_serial_number),''),p_condition_status,p_acquired_on,trim(p_notes),v_actor
  ) RETURNING id INTO v_id;

  INSERT INTO public.sports_inventory_asset_movements(
    tenant_id,asset_id,event_type,to_warehouse_id,notes,recorded_by
  ) VALUES (p_tenant_id,v_id,'receipt',p_warehouse_id,'ثبت اولیه دارایی',v_actor);

  RETURN QUERY SELECT v_id,v_code,v_barcode;
END;
$$;

CREATE OR REPLACE FUNCTION public.sports_inventory_transfer_asset(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_to_warehouse_id uuid,
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
  v_from uuid;
  v_event uuid;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships m
    WHERE m.tenant_id=p_tenant_id AND m.user_id=v_actor
      AND m.status='active' AND m.role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'Inventory administrator role required' USING ERRCODE='42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'Invalid asset transfer reason' USING ERRCODE='22023';
  END IF;
  SELECT warehouse_id INTO v_from
  FROM public.sports_inventory_assets
  WHERE id=p_asset_id AND tenant_id=p_tenant_id
    AND lifecycle_status NOT IN ('retired','lost')
  FOR UPDATE;
  IF v_from IS NULL OR v_from=p_to_warehouse_id THEN
    RAISE EXCEPTION 'Active asset and a different destination warehouse are required' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sports_inventory_warehouses w
    WHERE w.id=p_to_warehouse_id AND w.tenant_id=p_tenant_id AND w.is_active
  ) THEN
    RAISE EXCEPTION 'Active destination warehouse required' USING ERRCODE='23503';
  END IF;
  UPDATE public.sports_inventory_assets SET warehouse_id=p_to_warehouse_id,updated_at=now()
  WHERE id=p_asset_id AND tenant_id=p_tenant_id;
  INSERT INTO public.sports_inventory_asset_movements(
    tenant_id,asset_id,event_type,from_warehouse_id,to_warehouse_id,notes,reference_code,recorded_by
  ) VALUES (
    p_tenant_id,p_asset_id,'transfer',v_from,p_to_warehouse_id,trim(p_reason),
    nullif(trim(p_reference_code),''),v_actor
  ) RETURNING id INTO v_event;
  RETURN v_event;
END;
$$;

CREATE OR REPLACE FUNCTION public.sports_inventory_update_asset_status(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_new_status text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $
DECLARE
  v_actor uuid := auth.uid();
  v_old_status text;
  v_event_type text;
  v_event_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.sports_tenant_memberships m
    WHERE m.tenant_id=p_tenant_id AND m.user_id=v_actor
      AND m.status='active' AND m.role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'Inventory administrator role required' USING ERRCODE='42501';
  END IF;
  IF p_new_status NOT IN ('available','issued','maintenance','retired','lost')
     OR p_notes IS NULL OR length(trim(p_notes)) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'Invalid asset status change' USING ERRCODE='22023';
  END IF;
  SELECT lifecycle_status INTO v_old_status
  FROM public.sports_inventory_assets
  WHERE id=p_asset_id AND tenant_id=p_tenant_id
  FOR UPDATE;
  IF v_old_status IS NULL OR v_old_status IN ('retired','lost') OR v_old_status=p_new_status THEN
    RAISE EXCEPTION 'Asset status transition is not allowed' USING ERRCODE='22023';
  END IF;
  v_event_type := CASE p_new_status
    WHEN 'issued' THEN 'issue'
    WHEN 'available' THEN 'return'
    WHEN 'maintenance' THEN 'maintenance'
    WHEN 'retired' THEN 'retire'
    WHEN 'lost' THEN 'mark_lost'
  END;
  UPDATE public.sports_inventory_assets
  SET lifecycle_status=p_new_status,updated_at=now()
  WHERE id=p_asset_id AND tenant_id=p_tenant_id;
  INSERT INTO public.sports_inventory_asset_movements(
    tenant_id,asset_id,event_type,notes,recorded_by
  ) VALUES (p_tenant_id,p_asset_id,v_event_type,trim(p_notes),v_actor)
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$;

CREATE OR REPLACE FUNCTION public.sports_inventory_prevent_asset_movement_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public
AS $$
BEGIN
  RAISE EXCEPTION 'Inventory asset movement history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS sports_inventory_assets_updated_at ON public.sports_inventory_assets;
CREATE TRIGGER sports_inventory_assets_updated_at
BEFORE UPDATE ON public.sports_inventory_assets
FOR EACH ROW EXECUTE FUNCTION public.sports_inventory_set_updated_at();

DROP TRIGGER IF EXISTS sports_inventory_asset_movements_immutable ON public.sports_inventory_asset_movements;
CREATE TRIGGER sports_inventory_asset_movements_immutable
BEFORE UPDATE OR DELETE ON public.sports_inventory_asset_movements
FOR EACH ROW EXECUTE FUNCTION public.sports_inventory_prevent_asset_movement_mutation();

REVOKE ALL ON FUNCTION public.sports_inventory_transfer_stock(uuid,uuid,uuid,uuid,numeric,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.sports_inventory_register_asset(uuid,uuid,uuid,text,text,text,date,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.sports_inventory_transfer_asset(uuid,uuid,uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.sports_inventory_update_asset_status(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sports_inventory_transfer_stock(uuid,uuid,uuid,uuid,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sports_inventory_register_asset(uuid,uuid,uuid,text,text,text,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sports_inventory_transfer_asset(uuid,uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sports_inventory_update_asset_status(uuid,uuid,text,text) TO authenticated;

ALTER TABLE public.sports_inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_inventory_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_inventory_asset_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.sports_inventory_transfers,public.sports_inventory_assets,public.sports_inventory_asset_movements
FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE
  public.sports_inventory_transfers,public.sports_inventory_assets,public.sports_inventory_asset_movements
TO authenticated;
GRANT INSERT,UPDATE ON TABLE public.sports_inventory_assets TO authenticated;

CREATE POLICY sports_inventory_transfers_admin_read
ON public.sports_inventory_transfers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sports_tenant_memberships m
  WHERE m.tenant_id=sports_inventory_transfers.tenant_id AND m.user_id=(SELECT auth.uid())
    AND m.status='active' AND m.role IN ('owner','admin')));

CREATE POLICY sports_inventory_assets_admin_all
ON public.sports_inventory_assets FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.sports_tenant_memberships m
  WHERE m.tenant_id=sports_inventory_assets.tenant_id AND m.user_id=(SELECT auth.uid())
    AND m.status='active' AND m.role IN ('owner','admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.sports_tenant_memberships m
  WHERE m.tenant_id=sports_inventory_assets.tenant_id AND m.user_id=(SELECT auth.uid())
    AND m.status='active' AND m.role IN ('owner','admin')));

CREATE POLICY sports_inventory_asset_movements_admin_read
ON public.sports_inventory_asset_movements FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sports_tenant_memberships m
  WHERE m.tenant_id=sports_inventory_asset_movements.tenant_id AND m.user_id=(SELECT auth.uid())
    AND m.status='active' AND m.role IN ('owner','admin')));

COMMIT;
