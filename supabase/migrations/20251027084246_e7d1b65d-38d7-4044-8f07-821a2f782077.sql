-- Fix: Add manager role to users who have is_manager = true but lack the manager role
-- Step 1: Add missing manager roles to existing managers
INSERT INTO user_roles (user_id, role)
SELECT DISTINCT tm.user_id, 'manager'::app_role
FROM team_members tm
LEFT JOIN user_roles ur ON tm.user_id = ur.user_id AND ur.role = 'manager'
WHERE tm.is_manager = true
  AND ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 2: Create trigger function to automatically grant manager role
CREATE OR REPLACE FUNCTION public.ensure_manager_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If user is marked as manager in any team, ensure they have the manager role
  IF NEW.is_manager = true THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'manager'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Step 3: Create trigger on team_members table
DROP TRIGGER IF EXISTS ensure_manager_role_on_team_member ON public.team_members;

CREATE TRIGGER ensure_manager_role_on_team_member
AFTER INSERT OR UPDATE OF is_manager ON public.team_members
FOR EACH ROW
WHEN (NEW.is_manager = true)
EXECUTE FUNCTION public.ensure_manager_role();