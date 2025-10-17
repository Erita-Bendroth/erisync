-- Add request_group_id to track multi-day vacation requests
ALTER TABLE public.vacation_requests 
ADD COLUMN request_group_id uuid DEFAULT NULL;

-- Create index for efficient grouping queries
CREATE INDEX idx_vacation_requests_group_id ON public.vacation_requests(request_group_id);

-- Add comment explaining the field
COMMENT ON COLUMN public.vacation_requests.request_group_id IS 'Groups together multiple vacation_requests that are part of the same multi-day request. Single-day requests will have NULL group_id.';