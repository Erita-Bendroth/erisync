-- Update the generic late shift definition to match actual usage
UPDATE shift_time_definitions 
SET start_time = '10:00:00',
    end_time = '18:00:00',
    description = 'Late shift (default)',
    updated_at = now()
WHERE id = '1c2a00dd-0199-4b7e-bf28-8c426767a02d';