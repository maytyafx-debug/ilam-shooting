-- Integration tests for Migration 011; run only against disposable PostgreSQL.
BEGIN;

INSERT INTO auth.users(id) VALUES
 ('aaaaaaaa-1111-4111-8111-111111111111'),
 ('bbbbbbbb-2222-4222-8222-222222222222'),
 ('cccccccc-3333-4333-8333-333333333333')
ON CONFLICT DO NOTHING;

INSERT INTO public.sports_tenants(id,name,status) VALUES
 ('11111111-1111-4111-8111-111111111111','Tenant A','active'),
 ('22222222-2222-4222-8222-222222222222','Tenant B','active')
ON CONFLICT DO NOTHING;

INSERT INTO public.sports_tenant_memberships(tenant_id,user_id,role,status) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','owner','active'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-2222-4222-8222-222222222222','admin','active'),
 ('11111111-1111-4111-8111-111111111111','cccccccc-3333-4333-8333-333333333333','coach','active')
ON CONFLICT DO NOTHING;

INSERT INTO public.sports_inventory_warehouses(id,tenant_id,code,name,created_by) VALUES
 ('33333333-3333-4333-8333-333333333331','11111111-1111-4111-8111-111111111111','WH-A','Main A','aaaaaaaa-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;
INSERT INTO public.sports_inventory_items(id,tenant_id,sku,name,unit,minimum_quantity,created_by) VALUES
 ('44444444-4444-4444-8444-444444444441','11111111-1111-4111-8111-111111111111','ITEM-A','Shared sports equipment','عدد',2,'aaaaaaaa-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- 1. Same-tenant owner can receive stock and the database stores the exact balance.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',true);
SELECT public.sports_inventory_record_movement(
 '11111111-1111-4111-8111-111111111111',
 '44444444-4444-4444-8444-444444444441',
 '33333333-3333-4333-8333-333333333331',
 'receipt',12,'Initial stock receipt', 'INV-001'
);

DO $$
DECLARE v_qty numeric;
BEGIN
 SELECT quantity_on_hand INTO v_qty FROM public.sports_inventory_stock
 WHERE tenant_id='11111111-1111-4111-8111-111111111111'
   AND item_id='44444444-4444-4444-8444-444444444441'
   AND warehouse_id='33333333-3333-4333-8333-333333333331';
 IF v_qty <> 12 THEN RAISE EXCEPTION 'Receipt did not update stock balance'; END IF;
END $$;

-- 2. Issue larger than available stock must fail without changing the balance.
DO $$
BEGIN
 BEGIN
  PERFORM public.sports_inventory_record_movement(
   '11111111-1111-4111-8111-111111111111',
   '44444444-4444-4444-8444-444444444441',
   '33333333-3333-4333-8333-333333333331',
   'issue',-13,'Over-issue test',NULL
  );
  RAISE EXCEPTION 'Insufficient stock was unexpectedly accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;

-- 3. Valid issue reduces the balance and movement history cannot be edited.
SELECT public.sports_inventory_record_movement(
 '11111111-1111-4111-8111-111111111111',
 '44444444-4444-4444-8444-444444444441',
 '33333333-3333-4333-8333-333333333331',
 'issue',-2,'Equipment issued', 'ISS-001'
);

DO $$
DECLARE v_qty numeric; v_id uuid;
BEGIN
 SELECT quantity_on_hand INTO v_qty FROM public.sports_inventory_stock
 WHERE tenant_id='11111111-1111-4111-8111-111111111111'
   AND item_id='44444444-4444-4444-8444-444444444441'
   AND warehouse_id='33333333-3333-4333-8333-333333333331';
 IF v_qty <> 10 THEN RAISE EXCEPTION 'Issue did not reduce stock balance'; END IF;
 SELECT id INTO v_id FROM public.sports_inventory_movements
 WHERE reference_code='ISS-001';
 BEGIN
  UPDATE public.sports_inventory_movements SET reason='tampered' WHERE id=v_id;
  RAISE EXCEPTION 'Movement history unexpectedly allowed an update';
 EXCEPTION WHEN insufficient_privilege THEN
  NULL;
 END;
END $$;

-- 4. A non-admin coach cannot post inventory movements.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','cccccccc-3333-4333-8333-333333333333',true);
DO $$
BEGIN
 BEGIN
  PERFORM public.sports_inventory_record_movement(
   '11111111-1111-4111-8111-111111111111',
   '44444444-4444-4444-8444-444444444441',
   '33333333-3333-4333-8333-333333333331',
   'receipt',1,'Unauthorized receipt',NULL
  );
  RAISE EXCEPTION 'Non-admin role unexpectedly posted inventory';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;

-- 5. An admin from another tenant cannot read or change Tenant A inventory.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-2222-4222-8222-222222222222',true);
DO $$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count FROM public.sports_inventory_stock
 WHERE tenant_id='11111111-1111-4111-8111-111111111111';
 IF v_count <> 0 THEN RAISE EXCEPTION 'Cross-tenant inventory row was visible'; END IF;
 BEGIN
  PERFORM public.sports_inventory_record_movement(
   '11111111-1111-4111-8111-111111111111',
   '44444444-4444-4444-8444-444444444441',
   '33333333-3333-4333-8333-333333333331',
   'receipt',1,'Cross-tenant attempt',NULL
  );
  RAISE EXCEPTION 'Cross-tenant admin unexpectedly posted inventory';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;

ROLLBACK;
