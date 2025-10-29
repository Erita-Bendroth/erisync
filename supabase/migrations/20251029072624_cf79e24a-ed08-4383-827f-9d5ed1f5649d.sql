-- Clean up duplicate custom duty email templates
-- Keep only the most recent one for each combination of source_template_id, week_number, year, mode
DELETE FROM custom_duty_email_templates
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY source_template_id, week_number, year, mode 
        ORDER BY updated_at DESC, created_at DESC
      ) as rn
    FROM custom_duty_email_templates
  ) t
  WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_duty_email_templates_unique
ON custom_duty_email_templates (source_template_id, week_number, year, mode);