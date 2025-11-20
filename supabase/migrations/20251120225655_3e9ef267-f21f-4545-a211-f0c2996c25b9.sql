-- Remove section-based constraints to allow global reordering
ALTER TABLE sidebar_item_order 
  DROP CONSTRAINT IF EXISTS sidebar_item_order_user_id_section_item_key_key;

-- Add new unique constraint without section
ALTER TABLE sidebar_item_order 
  ADD CONSTRAINT sidebar_item_order_user_id_item_key_key 
  UNIQUE(user_id, item_key);

-- Update index to remove section
DROP INDEX IF EXISTS idx_sidebar_order_user_section;
CREATE INDEX idx_sidebar_order_user 
  ON sidebar_item_order(user_id);

-- Remove section column (keep for backward compatibility but make it nullable and remove from constraints)
ALTER TABLE sidebar_item_order 
  ALTER COLUMN section DROP NOT NULL;