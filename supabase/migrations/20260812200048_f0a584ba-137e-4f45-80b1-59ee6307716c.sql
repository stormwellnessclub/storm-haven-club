INSERT INTO public.spa_service_availability (service_id, therapist_id, room_id, day_of_week, start_time, end_time, max_bookings, is_active, specific_date)
SELECT s.service_id, '85fae30e-efae-4a3d-86dd-5101ba4bc25c', 'a685cf00-2a8f-4d1a-992c-4a1b6079c9ab', 3, '16:00:00', '17:30:00', 1, true, DATE '2026-08-12'
FROM (VALUES
 ('65d5cf7e-acdd-4c77-97aa-0283d57c2dc4'::uuid),
 ('acdbacfb-bdcc-4ad8-9712-0738bfc4187a'::uuid),
 ('652cd6ad-5071-4ef4-8287-430d3b1eb440'::uuid),
 ('2f474b02-9b46-408d-a20d-518805bf0e92'::uuid),
 ('6d6ddbbd-d4a7-4851-af39-610a7f820cde'::uuid),
 ('8ae7af29-4972-4b65-ac28-db730c3e461d'::uuid)
) AS s(service_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.spa_service_availability a
  WHERE a.therapist_id = '85fae30e-efae-4a3d-86dd-5101ba4bc25c'
    AND a.service_id = s.service_id
    AND a.specific_date = DATE '2026-08-12'
    AND a.start_time = '16:00:00'
);