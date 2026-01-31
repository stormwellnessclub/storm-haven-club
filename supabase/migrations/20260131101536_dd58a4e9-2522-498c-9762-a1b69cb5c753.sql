-- Import 16 new applications from CSV (Dec 27, 2025 - Jan 31, 2026)
-- Skipping duplicate: Deja Pryor (line 19) - already included from line 18
-- Using ON CONFLICT to prevent duplicates by email

INSERT INTO membership_applications (
  full_name, first_name, last_name, email, phone,
  date_of_birth, address, city, state, zip_code, country,
  membership_plan, founding_member, referred_by_member,
  wellness_goals, services_interested, lifestyle_integration,
  holistic_wellness, previous_member, gender, status,
  auth_acknowledgment, credit_card_auth, membership_agreement_signed,
  one_year_commitment, submission_confirmation, created_at
)
SELECT * FROM (VALUES
  -- 1. Wafaa Diab - Jan 31, 2026 @ 1:23 AM
  ('Wafaa Diab', 'Wafaa', 'Diab', 'wafdiab@gmail.com', '7349686303',
   '1971-06-17'::date, '7979 sleepy hollow drive', 'Northville', 'MI', '48168', 'United States of America (USA)',
   'Silver', 'No', 'Maysa Balbaki',
   ARRAY['Weight Loss', 'Improved Flexibility', 'Stress Reduction'],
   ARRAY['Fitness Classes', 'Open Gym', 'Personal Training'],
   'I am a realtor and a mother and work a lot',
   'I know you can get me in shape', 'YES', 'Not Specified', 'pending',
   true, true, true, true, true, '2026-01-31 01:23:00-05'::timestamptz),

  -- 2. Deanna Beydoun - Jan 31, 2026 @ 12:41 AM
  ('Deanna Beydoun', 'Deanna', 'Beydoun', 'dbeydoun44@gmail.com', '3139329174',
   '2026-12-25'::date, '11272 Fellows creek dr', 'Plymouth', 'MI', '48170', 'United States of America (USA)',
   'Silver', 'No', '',
   ARRAY['Weight Loss', 'Muscle Gain'],
   ARRAY['Open Gym', 'Spa Services'],
   '', '', 'YES', 'Not Specified', 'pending',
   true, true, true, true, true, '2026-01-31 00:41:00-05'::timestamptz),

  -- 3. Afifa Seblini - Jan 29, 2026 @ 2:40 AM
  ('Afifa Seblini', 'Afifa', 'Seblini', 'afifa.seblini@gmail.com', '3139321177',
   '1987-08-18'::date, '401 n John Daly rd', 'Dearborn Heights', 'Michigan', '48127', 'United States of America (USA)',
   'Silver', 'No', '',
   ARRAY['Weight Loss', 'Muscle Gain', 'Stress Reduction', 'Holistic Health'],
   ARRAY['Fitness Classes', 'Open Gym', 'Spa Services'],
   'I''m a busy mom with a full schedule, so I''m very intentional about taking care of my physical and mental health.',
   '', '', 'Not Specified', 'pending',
   true, true, true, true, true, '2026-01-29 02:40:00-05'::timestamptz),

  -- 4. Sherene Albosaraj - Jan 18, 2026 @ 5:59 PM
  ('Sherene Albosaraj', 'Sherene', 'Albosaraj', 'albosarajsherene@gmail.com', '3132472441',
   '2007-03-02'::date, '204 arcola st', 'Garden City', 'MI', '48135', 'United States of America (USA)',
   'Gold', 'No', '',
   ARRAY['Weight Loss', 'Muscle Gain', 'Stress Reduction'],
   ARRAY['Fitness Classes', 'Open Gym'],
   'I live a very active and goal oriented lifestyle, and health and fitness are an important part of my personal growth and daily routine.',
   'Holistic wellness means taking care of both my mind and body, not just focusing on physical fitness but also on mental clarity, balance, and overall well being.', 'NO', 'Not Specified', 'pending',
   true, true, true, true, true, '2026-01-18 17:59:00-05'::timestamptz),

  -- 5. Tiara Foster - Jan 18, 2026 @ 5:32 AM
  ('Tiara Foster', 'Tiara', 'Foster', 'facebytiaramona@gmail.com', '7474639292',
   '1993-06-23'::date, '11332 ASPEN DR', 'Plymouth', 'MI', '48170', 'United States of America (USA)',
   'Gold', 'Yes', '',
   ARRAY['Weight Loss', 'Muscle Gain', 'Improved Flexibility', 'Stress Reduction'],
   ARRAY['Fitness Classes', 'Open Gym', 'Personal Training'],
   'I''m currently on a glp1 and peptide therapy for weightloss. Now it is time to start to incorporate working out not only for weightloss but for overall health and discipline within myself.',
   'Holistic wellness means caring for the whole person—physically, mentally, and emotionally—while recognizing that true health is built through consistency, education, and individualized support.', 'YES', 'Not Specified', 'pending',
   true, true, true, true, true, '2026-01-18 05:32:00-05'::timestamptz),

  -- 6. Faten Saad - Jan 17, 2026 @ 4:14 PM
  ('Faten Saad', 'Faten', 'Saad', 'fatensaad1986@gmail.com', '3136088688',
   '1986-06-24'::date, '23010 SHERIDAN ST', 'Dearborn', 'MI', '48128', 'United States of America (USA)',
   'Gold', 'No', '',
   ARRAY['Muscle Gain', 'Stress Reduction', 'Holistic Health'],
   ARRAY['Fitness Classes', 'Open Gym', 'Spa Services'],
   'Taking care of my body and mind. I try to eat clean spend time outdoors. This is I''ll be an additional layer.',
   '', 'YES', 'Not Specified', 'pending',
   true, true, true, true, true, '2026-01-17 16:14:00-05'::timestamptz),

  -- 7. Jeniffer Meta - Jan 14, 2026 @ 7:26 PM
  ('Jeniffer Meta', 'Jeniffer', 'Meta', 'jennameta11@icloud.com', '2483928270',
   '2004-11-01'::date, '6275 Fairbrook Ct', 'West Bloomfield', 'Michigan', '48322', 'United States of America (USA)',
   'Silver', 'No', '',
   ARRAY['Muscle Gain', 'Improved Flexibility', 'Stress Reduction', 'Holistic Health'],
   ARRAY['Fitness Classes', 'Open Gym', 'Spa Services', 'Nutritional Guidance'],
   'I live a pretty active but busy lifestyle, so having a wellness space that supports both my physical and mental health is really important to me.',
   'Holistic wellness, to me, means caring for my body and mind together rather than treating them as separate.', 'YES', 'Not Specified', 'pending',
   true, true, true, true, true, '2026-01-14 19:26:00-05'::timestamptz),

  -- 8. Sarah Hamze - Jan 7, 2026 @ 6:14 AM
  ('Sarah Hamze', 'Sarah', 'Hamze', 'sarahhamze15@gmail.com', '3134926144',
   '1097-01-10'::date, '22900 Cherry Hill St', 'Dearborn', 'MI', '48124', 'United States of America (USA)',
   'Gold', 'No', '',
   ARRAY['Muscle Gain', 'Improved Flexibility', 'Stress Reduction', 'Holistic Health'],
   ARRAY['Fitness Classes', 'Open Gym', 'Spa Services', 'Personal Training', 'Nutritional Guidance'],
   'I am an injector so I am standing and hovering over for long periods of time and need time at the gym to relax and decompress.',
   'It means creating space for a peace of mind and with the wellness services & amenities as well as aesthetic and this gym will provide I feel like just by walking in I will immediately feel that.', 'YES', 'Not Specified', 'pending',
   true, true, true, true, true, '2026-01-07 06:14:00-05'::timestamptz),

  -- 9. Naydean Beydoun - Jan 3, 2026 @ 7:38 PM
  ('Naydean Beydoun', 'Naydean', 'Beydoun', 'naydeano@gmail.comn', '5174425110',
   '1999-04-26'::date, '27860 Terrence St', 'Livonia', 'Michigan', '48154', 'United States of America (USA)',
   'Silver', 'No', 'Hakim Hasnaweh',
   ARRAY['Muscle Gain', 'Stress Reduction', 'Holistic Health'],
   ARRAY['Open Gym', 'Spa Services', 'Personal Training'],
   'I''m a mother to 2 boys, and I have developed the pancake booty that comes with pregnancy and breastfeeding. I want to grow my glutes again and tighten my core!',
   'I try to live a non-toxic life as best as possible, we are very healthy conscious and prefer to do everything as organically possible.', 'YES', 'Not Specified', 'pending',
   true, true, true, true, true, '2026-01-03 19:38:00-05'::timestamptz),

  -- 10. Yara Hamed - Jan 1, 2026 @ 3:27 PM
  ('Yara Hamed', 'Yara', 'Hamed', 'yarah12405@gmail.com', '3136757754',
   '2005-01-24'::date, '26172 Hass st', 'Dearborn Heights', 'Michigan', '48127', 'United States of America (USA)',
   'Gold', 'No', '',
   ARRAY['Muscle Gain', 'Improved Flexibility', 'Stress Reduction', 'Holistic Health'],
   ARRAY['Fitness Classes', 'Open Gym', 'Spa Services', 'Personal Training', 'Nutritional Guidance'],
   'I live a busy but balanced lifestyle as a university student, so taking care of my physical and mental well-being is important to me.',
   'Holistic wellness means taking care of both my body and mind in a balanced, intentional way.', 'NO', 'Not Specified', 'pending',
   true, true, true, true, true, '2026-01-01 15:27:00-05'::timestamptz),

  -- 11. Nadine Atoui - Dec 30, 2025 @ 3:38 AM
  ('Nadine Atoui', 'Nadine', 'Atoui', 'nadine.a.atoui@gmail.com', '3135597379',
   '1996-05-20'::date, '45166 Thornhill Rd', 'Canton', 'MI', '48188', 'United States of America (USA)',
   'Silver', 'Yes', 'Rola Rayes',
   ARRAY['Weight Loss', 'Muscle Gain', 'Improved Flexibility', 'Stress Reduction'],
   ARRAY['Fitness Classes', 'Open Gym', 'Personal Training'],
   '', '', 'NO', 'Not Specified', 'pending',
   true, true, true, true, true, '2025-12-30 03:38:00-05'::timestamptz),

  -- 12. Deja Pryor - Dec 29, 2025 @ 5:18 PM (only inserting first entry, skipping duplicate)
  ('Deja Pryor', 'Deja', 'Pryor', 'dejampryor@gmail.com', '1313244884',
   '1997-03-04'::date, '434 WATSON ST', 'Detroit', 'Michigan', '48201', 'United States of America (USA)',
   'Gold', 'Yes', '',
   ARRAY['Muscle Gain', 'Improved Flexibility', 'Stress Reduction'],
   ARRAY['Fitness Classes', 'Open Gym', 'Spa Services'],
   'I am a hairstylist who plans to use the gym at 6am before coming to work and servicing my clients. I work out 5 times a week',
   'Holistic wellness to me means doing exactly what works best for your body type and goals. Listening to your body and understanding exactly what it needs', 'NO', 'Not Specified', 'pending',
   true, true, true, true, true, '2025-12-29 17:18:00-05'::timestamptz),

  -- 13. Zahraa Jaber - Dec 28, 2025 @ 4:37 PM
  ('Zahraa Jaber', 'Zahraa', 'Jaber', 'zkjaber76@gmail.com', '7347413600',
   '2004-04-09'::date, '11585 N RIDGE RD', 'Plymouth', 'MI', '48170', 'United States of America (USA)',
   'Platinum', 'Yes', '',
   ARRAY['Weight Loss', 'Stress Reduction', 'Holistic Health'],
   ARRAY['Fitness Classes', 'Open Gym', 'Spa Services', 'Nutritional Guidance'],
   'I workout about five time a week, and I do this by doing Pilates and cardio. I plan to incorporate my routine along with joining daily workout classes in the wellness center.',
   'Holistic wellness means a lot to me especially since I struggle with IBS, and my goal to use different amenities in the center which help calm and regulate my nervous system.', 'YES', 'Not Specified', 'pending',
   true, true, true, true, true, '2025-12-28 16:37:00-05'::timestamptz),

  -- 14. Jacklyn Gougeon - Dec 28, 2025 @ 3:14 PM
  ('Jacklyn Gougeon', 'Jacklyn', 'Gougeon', 'jackiemgougeon@gmail.com', '2483309681',
   '1999-09-11'::date, '45692 BRISTOL CIR', 'Novi', 'MI', '48377', 'United States of America (USA)',
   'Gold', 'No', '',
   ARRAY['Muscle Gain', 'Improved Flexibility', 'Stress Reduction'],
   ARRAY['Fitness Classes', 'Open Gym', 'Spa Services'],
   'As a mom, my lifestyle is full and fast-paced, and taking care of myself is essential so I can show up fully for my children, my work, and my home.',
   'To me, holistic health means taking care of my body, mind, and overall well-being in a balanced and sustainable way.', 'YES', 'Not Specified', 'pending',
   true, true, true, true, true, '2025-12-28 15:14:00-05'::timestamptz),

  -- 15. Nicolette Juncaj - Dec 27, 2025 @ 4:16 PM
  ('Nicolette Juncaj', 'Nicolette', 'Juncaj', 'lettagj@gmail.com', '5867850494',
   '1992-12-05'::date, '29992 Bobrich court', 'Livonia', 'MI', '48152', 'United States of America (USA)',
   'Silver', 'No', '',
   ARRAY['Muscle Gain', 'Stress Reduction', 'Holistic Health'],
   ARRAY['Fitness Classes', 'Open Gym', 'Spa Services'],
   'My lifestyle as a mom of 3 comprises of being always on the go (working, home tasks, kids) but I also make time for myself which is important in being a good mom - for my mental and physical well being.',
   'Holistic wellness to me means combining the elements of mind, body, and spirit to reach optimal health.', 'YES', 'Not Specified', 'pending',
   true, true, true, true, true, '2025-12-27 16:16:00-05'::timestamptz)
) AS new_apps(
  full_name, first_name, last_name, email, phone,
  date_of_birth, address, city, state, zip_code, country,
  membership_plan, founding_member, referred_by_member,
  wellness_goals, services_interested, lifestyle_integration,
  holistic_wellness, previous_member, gender, status,
  auth_acknowledgment, credit_card_auth, membership_agreement_signed,
  one_year_commitment, submission_confirmation, created_at
)
WHERE NOT EXISTS (
  SELECT 1 FROM membership_applications ma
  WHERE LOWER(ma.email) = LOWER(new_apps.email)
);