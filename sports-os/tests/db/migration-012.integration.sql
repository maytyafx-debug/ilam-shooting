-- Integration tests for Migration 012; run only on the disposable CI database after 011.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',true);

INSERT INTO public.sports_inventory_warehouses(id,tenant_id,code,name,created_by)
VALUES ('33333333-3333-4333-8333-333333333332','11111111-1111-4111-8111-111111111111','WH-B','Main B','aaaaaaaa-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- 1. Quantity transfer is atomic and creates a balanced pair of immutable movements.
SELECT public.sports_inventory_transfer_stock(
 '11111111-1111-4111-8111-111111111111',
 '44444444-4444-4444-8444-444444444441',
 '33333333-3333-4333-8333-333333333331',
 '33333333-3333-4333-8333-333333333332',
 4,'Inter-warehouse transfer','TR-001'
);

DO $$
DECLARE v_source numeric; v_destination numeric; v_transfer uuid; v_rows integer;
BEGIN
 SELECT quantity_on_hand INTO v_source FROM public.sports_inventory_stock
 WHERE tenant_id='11111111-1111-4111-8111-111111111111' AND item_id='44444444-4444-4444-8444-444444444441' AND warehouse_id='33333333-3333-4333-8333-333333333331';
 SELECT quantity_on_hand INTO v_destination FROM public.sports_inventory_stock
 WHERE tenant_id='11111111-1111-4111-8111-111111111111' AND item_id='44444444-4444-4444-8444-444444444441' AND warehouse_id='33333333-3333-4333-8333-333333333332';
 SELECT id INTO v_transfer FROM public.sports_inventory_transfers WHERE reference_code='TR-001';
 SELECT count(*) INTO v_rows FROM public.sports_inventory_movements WHERE transfer_id=v_transfer;
 IF v_source<>6 OR v_destination<>4 OR v_rows<>2 THEN
   RAISE EXCEPTION 'Quantity transfer did not preserve source/destination balances and paired ledger entries';
 END IF;
END $$;

-- 2. Over-transfer is rejected without partially changing either balance.
DO $$
BEGIN
 BEGIN
  PERFORM public.sports_inventory_transfer_stock(
   '11111111-1111-4111-8111-111111111111',
   '44444444-4444-4444-8444-444444444441',
   '33333333-3333-4333-8333-333333333331',
   '33333333-3333-4333-8333-333333333332',
   99,'Over-transfer test',NULL
  );
  RAISE EXCEPTION 'Over-transfer unexpectedly succeeded';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;

-- 3. Individual assets receive a unique asset code/QR payload and append-only location history.
INSERT INTO public.sports_inventory_items(id,tenant_id,sku,name,unit,tracking_mode,created_by)
VALUES ('44444444-4444-4444-8444-444444444442','11111111-1111-4111-8111-111111111111','ASSET-A','Individually tracked sports asset','عدد','individual','aaaaaaaa-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

DO $$
DECLARE v_asset uuid; v_code text; v_barcode text; v_event uuid; v_warehouse uuid; v_count integer;
BEGIN
 SELECT asset_id,asset_code,barcode_value INTO v_asset,v_code,v_barcode
 FROM public.sports_inventory_register_asset(
  '11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444442',
  '33333333-3333-4333-8333-333333333331',
  NULL,NULL,'good',NULL,'CI asset registration'
 );
 IF v_asset IS NULL OR v_code IS NULL OR v_barcode<>v_code THEN
   RAISE EXCEPTION 'Asset registration did not return a stable QR identifier';
 END IF;
 SELECT sports_inventory_transfer_asset(
  '11111111-1111-4111-8111-111111111111',v_asset,
  '33333333-3333-4333-8333-333333333332','Asset moved for testing','ASSET-TR-01'
 ) INTO v_event;
 SELECT warehouse_id INTO v_warehouse FROM public.sports_inventory_assets WHERE id=v_asset;
 SELECT count(*) INTO v_count FROM public.sports_inventory_asset_movements WHERE asset_id=v_asset;
 IF v_warehouse<>'33333333-3333-4333-8333-333333333332' OR v_count<>2 THEN
   RAISE EXCEPTION 'Serialized asset transfer or immutable ledger failed';
 END IF;
END $$;

-- 4. Quantity movement API/RPC cannot mutate individual-asset tracked stock.
DO $$
BEGIN
 BEGIN
  PERFORM public.sports_inventory_record_movement(
   '11111111-1111-4111-8111-111111111111',
   '44444444-4444-4444-8444-444444444442',
   '33333333-3333-4333-8333-333333333331',
   'receipt',1,'Invalid quantity receipt for serialized item',NULL
  );
  RAISE EXCEPTION 'Quantity movement unexpectedly accepted for an individual asset item';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $$;

ROLLBACK;
