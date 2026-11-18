-- Manual rollback for Migration 012. Review dependencies before running.
BEGIN;

DROP POLICY IF EXISTS sports_inventory_asset_movements_admin_read ON public.sports_inventory_asset_movements;
DROP POLICY IF EXISTS sports_inventory_assets_admin_all ON public.sports_inventory_assets;
DROP POLICY IF EXISTS sports_inventory_transfers_admin_read ON public.sports_inventory_transfers;

DROP TRIGGER IF EXISTS sports_inventory_asset_movements_immutable ON public.sports_inventory_asset_movements;
DROP TRIGGER IF EXISTS sports_inventory_assets_updated_at ON public.sports_inventory_assets;

DROP FUNCTION IF EXISTS public.sports_inventory_transfer_asset(uuid,uuid,uuid,text,text);
DROP FUNCTION IF EXISTS public.sports_inventory_register_asset(uuid,uuid,uuid,text,text,text,date,text);
DROP FUNCTION IF EXISTS public.sports_inventory_transfer_stock(uuid,uuid,uuid,uuid,numeric,text,text);
DROP FUNCTION IF EXISTS public.sports_inventory_prevent_asset_movement_mutation();

ALTER TABLE public.sports_inventory_movements
  DROP CONSTRAINT IF EXISTS sports_inventory_movements_transfer_fk;
ALTER TABLE public.sports_inventory_movements
  DROP CONSTRAINT IF EXISTS sports_inventory_movements_direction_check;
ALTER TABLE public.sports_inventory_movements
  DROP CONSTRAINT IF EXISTS sports_inventory_movements_movement_type_check;
ALTER TABLE public.sports_inventory_movements
  DROP COLUMN IF EXISTS transfer_id;
ALTER TABLE public.sports_inventory_movements
  ADD CONSTRAINT sports_inventory_movements_movement_type_check
  CHECK (movement_type IN ('receipt','return','issue','consumption','adjustment','correction'));
ALTER TABLE public.sports_inventory_movements
  ADD CONSTRAINT sports_inventory_movements_check
  CHECK (
    (movement_type IN ('receipt','return') AND quantity_delta > 0)
    OR (movement_type IN ('issue','consumption') AND quantity_delta < 0)
    OR movement_type IN ('adjustment','correction')
  );

DROP TABLE IF EXISTS public.sports_inventory_asset_movements;
DROP TABLE IF EXISTS public.sports_inventory_assets;
DROP TABLE IF EXISTS public.sports_inventory_transfers;

CREATE OR REPLACE FUNCTION public.sports_inventory_record_movement(
  p_tenant_id uuid,p_item_id uuid,p_warehouse_id uuid,p_movement_type text,
  p_quantity_delta numeric,p_reason text,p_reference_code text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $
DECLARE
  v_actor uuid := auth.uid();
  v_balance numeric(14,3);
  v_movement_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authenticated actor required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
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
  ) OR NOT EXISTS (
    SELECT 1 FROM public.sports_inventory_warehouses w
    WHERE w.id=p_warehouse_id AND w.tenant_id=p_tenant_id AND w.is_active
  ) THEN
    RAISE EXCEPTION 'Active item and warehouse in the selected organization are required' USING ERRCODE='23503';
  END IF;
  INSERT INTO public.sports_inventory_stock(tenant_id,item_id,warehouse_id,quantity_on_hand)
  VALUES (p_tenant_id,p_item_id,p_warehouse_id,0)
  ON CONFLICT (tenant_id,item_id,warehouse_id) DO NOTHING;
  SELECT quantity_on_hand INTO v_balance FROM public.sports_inventory_stock
  WHERE tenant_id=p_tenant_id AND item_id=p_item_id AND warehouse_id=p_warehouse_id FOR UPDATE;
  IF v_balance+p_quantity_delta<0 THEN
    RAISE EXCEPTION 'Insufficient stock for this movement' USING ERRCODE='23514';
  END IF;
  UPDATE public.sports_inventory_stock SET quantity_on_hand=v_balance+p_quantity_delta,updated_at=now()
  WHERE tenant_id=p_tenant_id AND item_id=p_item_id AND warehouse_id=p_warehouse_id;
  INSERT INTO public.sports_inventory_movements(
    tenant_id,item_id,warehouse_id,movement_type,quantity_delta,reason,reference_code,recorded_by
  ) VALUES (p_tenant_id,p_item_id,p_warehouse_id,p_movement_type,p_quantity_delta,
    trim(p_reason),nullif(trim(p_reference_code),''),v_actor)
  RETURNING id INTO v_movement_id;
  RETURN v_movement_id;
END;
$;
REVOKE ALL ON FUNCTION public.sports_inventory_record_movement(uuid,uuid,uuid,text,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sports_inventory_record_movement(uuid,uuid,uuid,text,numeric,text,text) TO authenticated;

COMMIT;
