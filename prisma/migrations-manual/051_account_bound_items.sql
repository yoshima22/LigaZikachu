-- Itens vinculados à conta (Rebote do Miauvadão): subconjunto da quantidade que não pode ser negociado.
ALTER TABLE player_inventory ADD COLUMN IF NOT EXISTS "boundQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mascot_food_items ADD COLUMN IF NOT EXISTS "boundQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mascot_eggs ADD COLUMN IF NOT EXISTS "accountBound" BOOLEAN NOT NULL DEFAULT false;

-- Invariante: boundQuantity nunca passa de quantity. Qualquer consumo/escrow que reduza a quantidade
-- gasta primeiro as unidades comuns (o trigger recorta as vinculadas só se não sobrar outra saída).
CREATE OR REPLACE FUNCTION clamp_bound_quantity() RETURNS trigger AS $$
BEGIN
  NEW."boundQuantity" := GREATEST(0, LEAST(NEW."boundQuantity", NEW.quantity));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS player_inventory_clamp_bound ON player_inventory;
CREATE TRIGGER player_inventory_clamp_bound BEFORE INSERT OR UPDATE ON player_inventory
  FOR EACH ROW EXECUTE FUNCTION clamp_bound_quantity();

DROP TRIGGER IF EXISTS mascot_food_items_clamp_bound ON mascot_food_items;
CREATE TRIGGER mascot_food_items_clamp_bound BEFORE INSERT OR UPDATE ON mascot_food_items
  FOR EACH ROW EXECUTE FUNCTION clamp_bound_quantity();
