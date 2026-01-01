-- Drop the old constraint
ALTER TABLE public.members 
DROP CONSTRAINT IF EXISTS members_status_check;

-- Add the updated constraint with pending_activation and other values
ALTER TABLE public.members 
ADD CONSTRAINT members_status_check 
CHECK (status = ANY (ARRAY[
  'active',
  'pending_activation',
  'inactive',
  'suspended',
  'past_due',
  'frozen',
  'expired',
  'cancelled'
]));

-- Insert the missing member record for the test user
INSERT INTO public.members (
  first_name,
  last_name,
  email,
  phone,
  membership_type,
  status,
  user_id,
  approved_at,
  activation_deadline
)
SELECT 
  'Storm',
  'Fitness',
  'stormfitnessllc@gmail.com',
  NULL,
  'Gold Membership',
  'pending_activation',
  '69857dc8-bf47-4ff4-9a5c-1c171d66186f',
  NOW(),
  NOW() + INTERVAL '7 days'
WHERE NOT EXISTS (
  SELECT 1 FROM public.members WHERE email = 'stormfitnessllc@gmail.com'
);