-- Add table_layout column to weekly_duty_templates to store custom table structure and content
ALTER TABLE public.weekly_duty_templates
ADD COLUMN table_layout JSONB;

COMMENT ON COLUMN public.weekly_duty_templates.table_layout IS 'Stores the complete custom table structure including regions, rows, columns, cell content, and colors';