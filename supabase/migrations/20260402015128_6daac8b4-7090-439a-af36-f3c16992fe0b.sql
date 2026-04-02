
-- Spa Services table
CREATE TABLE public.spa_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  cleanup_minutes integer NOT NULL DEFAULT 15,
  price numeric(10,2) NOT NULL,
  member_price numeric(10,2),
  is_active boolean NOT NULL DEFAULT false,
  display_order integer DEFAULT 0,
  popular boolean DEFAULT false,
  requires_intake_form boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Spa Therapists table
CREATE TABLE public.spa_therapists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  bio text,
  specialties text[] DEFAULT '{}',
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Spa Rooms table
CREATE TABLE public.spa_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  room_type text NOT NULL DEFAULT 'treatment',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Spa Therapist-Services junction
CREATE TABLE public.spa_therapist_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.spa_therapists(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.spa_services(id) ON DELETE CASCADE,
  UNIQUE(therapist_id, service_id)
);

-- Spa Service Availability
CREATE TABLE public.spa_service_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.spa_services(id) ON DELETE CASCADE,
  therapist_id uuid REFERENCES public.spa_therapists(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.spa_rooms(id) ON DELETE SET NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_bookings integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true
);

-- Spa Service Add-ons
CREATE TABLE public.spa_service_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  applicable_categories text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.spa_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spa_therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spa_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spa_therapist_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spa_service_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spa_service_addons ENABLE ROW LEVEL SECURITY;

-- Public read for spa_services (public page needs it)
CREATE POLICY "Anyone can view spa services" ON public.spa_services FOR SELECT USING (true);

-- Staff manage spa_services
CREATE POLICY "Staff can manage spa services" ON public.spa_services FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff']::public.app_role[]));

-- Public read for spa_therapists
CREATE POLICY "Anyone can view spa therapists" ON public.spa_therapists FOR SELECT USING (true);

-- Staff manage spa_therapists
CREATE POLICY "Staff can manage spa therapists" ON public.spa_therapists FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff']::public.app_role[]));

-- Public read for spa_rooms
CREATE POLICY "Anyone can view spa rooms" ON public.spa_rooms FOR SELECT USING (true);

-- Staff manage spa_rooms
CREATE POLICY "Staff can manage spa rooms" ON public.spa_rooms FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff']::public.app_role[]));

-- Public read for spa_therapist_services
CREATE POLICY "Anyone can view therapist services" ON public.spa_therapist_services FOR SELECT USING (true);

-- Staff manage spa_therapist_services
CREATE POLICY "Staff can manage therapist services" ON public.spa_therapist_services FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff']::public.app_role[]));

-- Public read for spa_service_availability
CREATE POLICY "Anyone can view service availability" ON public.spa_service_availability FOR SELECT USING (true);

-- Staff manage spa_service_availability
CREATE POLICY "Staff can manage service availability" ON public.spa_service_availability FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff']::public.app_role[]));

-- Public read for spa_service_addons
CREATE POLICY "Anyone can view spa addons" ON public.spa_service_addons FOR SELECT USING (true);

-- Staff manage spa_service_addons
CREATE POLICY "Staff can manage spa addons" ON public.spa_service_addons FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','manager','spa_staff']::public.app_role[]));

-- Seed spa_services from existing hardcoded data (all inactive)
INSERT INTO public.spa_services (name, description, category, duration_minutes, cleanup_minutes, price, member_price, is_active, display_order, popular) VALUES
('Root Chakra Ritual', 'A grounding ritual focused on stabilizing the body and calming the nervous system. Emphasizes lower body, feet, hips, and breath guidance with warm oils and slow rhythmic pressure.', 'Body Rituals', 75, 15, 205, NULL, false, 1, false),
('Sacral Chakra Ritual', 'A sensory ritual designed to restore flow, emotional fluidity, and creative energy. Warm compresses, hip and lower abdominal focus, gentle oil massage, and movement stimulation.', 'Body Rituals', 75, 15, 215, NULL, false, 2, false),
('Solar Plexus Chakra Ritual', 'A transformative ritual activating the core and energetic drive. Integrates warming oils, infrared heat, abdominal work, and rhythmic stimulation to cultivate vitality and confidence.', 'Body Rituals', 90, 20, 260, NULL, false, 3, true),
('Heart Chakra Ritual', 'A calming ritual centered on chest, shoulders, and upper body. Aromatic oils and sustained holds promote emotional release, openness, and relief from stress.', 'Body Rituals', 75, 15, 255, NULL, false, 4, false),
('Throat Chakra Ritual', 'A neck, jaw, and scalp focused ritual supporting communication and self-expression. Warm oils, jaw release techniques, and shoulder decompression.', 'Body Rituals', 60, 15, 225, NULL, false, 5, false),
('Third Eye Chakra Ritual', 'A meditative ritual centered on temples, scalp, face, and upper spine. Gentle lymphatic flow, pressure holds, and calm aromatics promote mental clarity.', 'Body Rituals', 75, 15, 245, NULL, false, 6, false),
('Crown Chakra Ritual (Integration)', 'The flagship ritual integrating full-body guided breath, warm oils, and rhythmic flow to harmonize all energetic centers. Designed for profound restoration and nervous system reset.', 'Body Rituals', 90, 20, 295, NULL, false, 7, true),
('Detox Seaweed & Charcoal Wrap', 'Premium seaweed + activated charcoal infusion to purify skin and support body detoxification.', 'Body Wraps', 60, 15, 165, NULL, false, 8, false),
('Detox Seaweed & Charcoal Wrap (Extended)', 'Full body detox wrap with exfoliating scrub + short relaxation massage to stimulate.', 'Body Wraps', 90, 20, 225, NULL, false, 9, false),
('Anti-Aging Collagen Wrap', 'Collagen-rich wrap to improve elasticity, reduce dryness, and support firmer skin tone.', 'Body Wraps', 60, 15, 175, NULL, false, 10, true),
('Anti-Aging Collagen Wrap (Extended)', 'Collagen infusion with full body scrub + short massage to enhance absorption and improve texture.', 'Body Wraps', 90, 20, 235, NULL, false, 11, false),
('Brightening Vitamin C Wrap', 'Vitamin C antioxidants to brighten, awaken, and even overall skin tone.', 'Body Wraps', 60, 15, 165, NULL, false, 12, false),
('Mud Therapy Wrap', 'Mineral mud cleanse to exfoliate and reduce inflammation while drawing toxins from the body.', 'Body Wraps', 60, 15, 160, NULL, false, 13, false),
('Hydration Boost Aloe Vera Wrap', 'Soothing aloe infusion to rehydrate and calm dry, irritated, or stressed skin.', 'Body Wraps', 60, 15, 155, NULL, false, 14, false),
('Relaxing Chamomile Wrap', 'Chamomile essence wrap to reduce body tension and promote calmness.', 'Body Wraps', 60, 15, 150, NULL, false, 15, false),
('Nourishing Avocado & Coconut Wrap', 'Rich avocado + coconut oils to restore hydration and soften skin.', 'Body Wraps', 60, 15, 175, NULL, false, 16, false),
('Coffee Sculpting Wrap', 'Caffeine-infused wrap to stimulate circulation and improve skin firmness.', 'Body Wraps', 60, 15, 180, NULL, false, 17, false),
('Storm Signature Massage — 60', 'A calming full-body massage using slow rhythmic movements and guided breath to reduce stress and support relaxation.', 'Massage', 60, 15, 120, NULL, false, 18, false),
('Storm Signature Massage — 90', 'A longer session with extended lower body and neck work to deepen relaxation and support nervous system regulation.', 'Massage', 90, 20, 155, NULL, false, 19, true),
('Deep Relief Massage — 60', 'Intentional deep-pressure bodywork focused on muscular tension and chronic tightness.', 'Massage', 60, 15, 145, NULL, false, 20, false),
('Deep Relief Massage — 90', 'Extended session with deeper muscular release, fascia attention, and targeted area focus to reduce chronic tightness.', 'Massage', 90, 20, 185, NULL, false, 21, true),
('Sports Performance Massage — 60', 'Athletic-focused massage integrating compression, assisted mobility, stretching, and stimulation for training recovery.', 'Massage', 60, 15, 150, NULL, false, 22, false),
('Sports Performance Massage — 90', 'Extended performance session with joint mobility, fascia attention, hip/shoulder work, and post-session grounding.', 'Massage', 90, 20, 195, NULL, false, 23, false),
('Lymph & Flow Massage — 60', 'Gentle rhythmic massage to stimulate lymph movement, reduce retention, and support whole-body calm.', 'Massage', 60, 15, 160, NULL, false, 24, false),
('Lymph & Flow Massage — 90', 'Extended lymphatic session including abdomen focus and scalp finishing for internal balance and lightness.', 'Massage', 90, 20, 205, NULL, false, 25, false),
('Prenatal Massage — 60', 'A restorative prenatal-safe massage to relieve lower back pressure, calm tension, and support circulation during pregnancy.', 'Massage', 60, 15, 165, NULL, false, 26, false),
('Prenatal Massage — 90', 'Extended prenatal session with hip support, lower body decompression, and guided relaxation for expecting mothers.', 'Massage', 90, 20, 215, NULL, false, 27, false),
('Age-Defying Facial — 60', 'A luxurious anti-aging facial focusing on lifting, firming, and smoothing the skin with advanced serums targeting fine lines and wrinkles.', 'Facials', 60, 15, 175, NULL, false, 28, false),
('Age-Defying Facial — 90', 'Extended anti-aging facial including deeper treatment time, targeted lifting techniques, and added massage to enhance firmness.', 'Facials', 90, 20, 215, NULL, false, 29, true),
('Botanical Bliss Facial — 60', 'An all-natural facial using organic botanical extracts to nourish and heal the skin. Ideal for sensitive skin types.', 'Facials', 60, 15, 160, NULL, false, 30, false),
('Botanical Bliss Facial — 90', 'Extended botanical facial with added exfoliation and facial massage to maximize nourishment and soothe inflammation.', 'Facials', 90, 20, 205, NULL, false, 31, false),
('Customized Facial — 60', 'A personalized facial tailored to hydration, anti-aging, congestion, or sensitivity. Adjusts products and techniques to meet individual skin needs.', 'Facials', 60, 15, 165, NULL, false, 32, false),
('Customized Facial — 90', 'Extended tailored treatment with deeper exfoliation, serum layering, and targeted massage for full skin balance and renewal.', 'Facials', 90, 20, 215, NULL, false, 33, false),
('Detoxifying Purity Facial — 60', 'Deep cleansing facial for congested or acne-prone skin. Includes charcoal mask and extractions to remove impurities.', 'Facials', 60, 15, 165, NULL, false, 34, false),
('Hydration Infusion Facial — 60', 'Intense moisture infusion using hyaluronic-rich products to deeply hydrate dry or depleted skin.', 'Facials', 60, 15, 160, NULL, false, 35, false),
('Hydration Infusion Facial — 90', 'Extended hydration treatment with deeper absorption and massage to sustain moisture and promote long-term suppleness.', 'Facials', 90, 20, 205, NULL, false, 36, false),
('Peptide Renewal Facial — 60', 'Peptide-focused facial promoting collagen production and skin renewal. Ideal for improving texture and diminishing fine lines.', 'Facials', 60, 15, 175, NULL, false, 37, false),
('Peptide Renewal Facial — 90', 'Extended peptide treatment with advanced serum layering and massage to enhance elasticity and deep renewal.', 'Facials', 90, 20, 225, NULL, false, 38, true),
('Radiant Glow Facial — 60', 'Rejuvenating facial designed to enhance natural radiance with gentle exfoliation and hydrating serums.', 'Facials', 60, 15, 160, NULL, false, 39, false),
('Radiant Glow Facial — 90', 'Extended glow treatment with enhanced exfoliation and prolonged massage to promote luminosity.', 'Facials', 90, 20, 205, NULL, false, 40, false),
('Vitamin C Brightening Facial — 60', 'Brightening facial infused with Vitamin C to target pigmentation, dullness, and uneven tone.', 'Facials', 60, 15, 165, NULL, false, 41, false),
('Vitamin C Brightening Facial — 90', 'Extended Vitamin C treatment with deeper exfoliation and massage to improve clarity, radiance, and skin brightness.', 'Facials', 90, 20, 215, NULL, false, 42, false),
('Full-Body Red Light Therapy — 10', 'Full-body exposure to red and near-infrared wavelengths to support cellular energy, circulation, inflammation reduction, and muscle recovery.', 'Recovery', 10, 5, 18, 12, false, 43, false),
('Full-Body Red Light Therapy — 20', 'Extended session designed to promote collagen production, speed recovery, reduce soreness, and enhance overall wellness.', 'Recovery', 20, 5, 28, 20, false, 44, true);
