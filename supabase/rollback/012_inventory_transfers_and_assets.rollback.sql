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

COMMIT;
