-- First, drop ALL existing policies on holidays table
DROP POLICY IF EXISTS "holidays_select_policy" ON public.holidays;
DROP POLICY IF EXISTS "holidays_insert_policy" ON public.holidays;  
DROP POLICY IF EXISTS "holidays_update_policy" ON public.holidays;
DROP POLICY IF EXISTS "holidays_delete_policy" ON public.holidays;
DROP POLICY IF EXISTS "Admins can manage all holidays" ON public.holidays;
DROP POLICY IF EXISTS "Users can view their own holidays" ON public.holidays;