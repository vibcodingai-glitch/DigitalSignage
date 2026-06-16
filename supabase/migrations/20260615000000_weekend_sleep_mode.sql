-- Add weekend_sleep_mode column to organizations
ALTER TABLE public.organizations
ADD COLUMN weekend_sleep_mode BOOLEAN DEFAULT FALSE NOT NULL;
