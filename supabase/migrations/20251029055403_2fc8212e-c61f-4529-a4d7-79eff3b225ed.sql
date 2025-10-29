-- Add mode and source_template_id columns to custom_duty_email_templates table
ALTER TABLE custom_duty_email_templates 
ADD COLUMN mode text DEFAULT 'custom' CHECK (mode IN ('auto', 'custom', 'hybrid')),
ADD COLUMN source_template_id uuid REFERENCES weekly_duty_templates(id);