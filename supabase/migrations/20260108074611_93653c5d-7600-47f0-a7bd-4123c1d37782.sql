-- Make target columns nullable for open offers
ALTER TABLE public.shift_swap_requests 
ALTER COLUMN target_user_id DROP NOT NULL,
ALTER COLUMN target_entry_id DROP NOT NULL;

-- Add is_open_offer column
ALTER TABLE public.shift_swap_requests 
ADD COLUMN is_open_offer boolean NOT NULL DEFAULT false;

-- Add index for open offers queries
CREATE INDEX idx_shift_swap_requests_open_offers 
ON public.shift_swap_requests (is_open_offer, status) 
WHERE is_open_offer = true;