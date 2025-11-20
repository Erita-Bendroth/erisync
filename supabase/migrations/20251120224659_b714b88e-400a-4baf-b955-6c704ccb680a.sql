-- Create sidebar_item_order table for personalized sidebar ordering
CREATE TABLE sidebar_item_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  item_key TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, section, item_key)
);

-- Enable RLS
ALTER TABLE sidebar_item_order ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own sidebar order
CREATE POLICY "Users can manage own sidebar order"
  ON sidebar_item_order
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_sidebar_order_user_section 
  ON sidebar_item_order(user_id, section);

-- Trigger to update updated_at
CREATE TRIGGER update_sidebar_item_order_updated_at
  BEFORE UPDATE ON sidebar_item_order
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();