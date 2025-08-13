-- Add new activity types to the enum
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'out_of_office';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'training';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'flextime';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'working_from_home';