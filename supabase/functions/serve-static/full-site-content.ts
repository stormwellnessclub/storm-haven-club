export const FULL_SITE_CONTENT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Full Site Content — Storm Wellness Club</title>
  <meta name="robots" content="noindex, nofollow">
  <style>body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:2rem;line-height:1.6;color:#222}h1,h2,h3{margin-top:2rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f5}.price{font-weight:bold;color:#2a5d3a}.section{border-top:2px solid #333;padding-top:1.5rem;margin-top:2rem}</style>
</head>
<body>
<h1>Storm Wellness Club — Full Site Content</h1>
<p><strong>Live URL:</strong> <a href="https://www.stormwellnessclub.com">https://www.stormwellnessclub.com</a></p>
<p><strong>Location:</strong> 18340 Middlebelt Rd, Livonia, MI 48152</p>
<p><strong>Type:</strong> Premium wellness &amp; fitness club (women-focused, men welcome)</p>
<p><strong>Tech Stack:</strong> React (Vite), Tailwind CSS, TypeScript, Supabase, Stripe</p>
<p><em>For the metadata summary (sitemap, SEO notes), see <a href="?file=site-audit">?file=site-audit</a></em></p>

<!-- ==================== HOMEPAGE ==================== -->
<div class="section">
<h2>Homepage (/)</h2>

<h3>Hero</h3>
<p><strong>Headline:</strong> The Wellness Solution You Have Been Seeking</p>
<p><strong>Subtext:</strong> Where physical, mental, and spiritual wellness converge in an exclusive sanctuary.</p>
<p><strong>CTAs:</strong> "Apply for Membership" → /apply | "Explore Memberships" → /memberships</p>

<h3>Quick Navigation</h3>
<ul>
<li>View Classes — Explore our full schedule → /classes</li>
<li>Book Aella Spa — Open to all, no membership → /spa</li>
<li>Café Menu — Fresh &amp; healthy options → /cafe</li>
<li>Amenities — Member facilities → /amenities</li>
</ul>

<h3>Three Distinct Studios</h3>
<p><strong>Subtitle:</strong> A harmonious blend of mental clarity, emotional resilience, and physical strength—designed to address all facets of wellness.</p>
<ul>
<li><strong>Reformer Pilates</strong> — A mixture of reformer classes, both heated and non-heated options</li>
<li><strong>Cycling Studio</strong> — High-energy rides with immersive lighting and cinematic sound</li>
<li><strong>Aerobics Room</strong> — Bootcamp, Sculpt, Yoga, HIIT and more in our versatile studio</li>
</ul>

<h3>Aella Spa Section</h3>
<p><strong>Heading:</strong> A Sanctuary for Renewal &amp; Restoration</p>
<p>Open to all—no membership required. Our holistic approach encompasses a wide range of treatments designed to support every step of your wellness journey.</p>
<ul>
<li>Signature Facials → /spa?category=Facials</li>
<li>Therapeutic Massage → /spa?category=Massage</li>
<li>Body Treatments → /spa?category=Body Wraps</li>
</ul>

<h3>Member Benefits</h3>
<p><strong>Heading:</strong> A Comprehensive Approach to Wellness</p>
<p>We believe that true fitness transcends physical boundaries. Our exclusive center is designed to address all facets of wellness—body, mind, and spirit.</p>
<p><strong>Recovery Suite:</strong> Infrared Sauna, Steam Room, Cold Plunge Pool, Red Light Therapy, Starpool ZeroBody Cryo</p>
<p><strong>Lifestyle &amp; Comfort:</strong> Luxury Locker Rooms, Relaxation Lounge, Café Access, Kids Care</p>

<h3>Our Philosophy</h3>
<p><strong>Heading:</strong> A Blend of Science &amp; Soul</p>
<p>At Storm Wellness Club, we believe in the harmonious integration of evidence-based wellness practices with the deeper, intuitive understanding of the human spirit. Our approach combines cutting-edge science with mindful, soulful practices to create transformative experiences.</p>

<h3>The Storm Café</h3>
<p><strong>Heading:</strong> Nourish From Within</p>
<p>Support your wellness journey with our curated menu of fresh juices, smoothies, and health-forward cuisine designed to fuel your transformation.</p>

<h3>Storm Kids Care</h3>
<p>Prioritize your health while your little ones enjoy supervised care in our dedicated space. Available to members with a Kids Care add-on.</p>

<h3>Final CTA</h3>
<p><strong>Heading:</strong> Begin Your Wellness Journey</p>
<p>Embark on a journey where physical, mental, and spiritual wellness converge in an exclusive sanctuary.</p>
</div>

<!-- ==================== MEMBERSHIPS ==================== -->
<div class="section">
<h2>Memberships (/memberships)</h2>

<h3>Hero</h3>
<p><strong>Heading:</strong> Membership Tiers</p>
<p>Application-Based Membership. Explore our tiered memberships to find the perfect fit for your wellness goals. All members enjoy access to premier facilities and preferred pricing on spa services.</p>

<h3>Core Benefits (Included in Every Membership)</h3>
<ul>
<li>State-of-the-art gym facilities</li>
<li>Sauna &amp; Steam Room</li>
<li>Himalayan Salt Room</li>
<li>Cold Plunge Pool</li>
<li>Luxury Locker Rooms</li>
<li>Preferred pricing on spa services</li>
</ul>

<h3>Luxurious Spa Amenities</h3>
<table>
<tr><th>Amenity</th><th>Description</th></tr>
<tr><td>Himalayan Salt Room</td><td>Promotes respiratory health and skin rejuvenation</td></tr>
<tr><td>Steam Room</td><td>Detoxify your body and relax your muscles</td></tr>
<tr><td>Sauna</td><td>Improve circulation and promote healthy perspiration</td></tr>
<tr><td>Cold Plunge</td><td>Reduce inflammation and accelerate recovery</td></tr>
<tr><td>Dry Cryo Bed</td><td>Enhanced recovery without getting wet</td></tr>
<tr><td>Red Light Therapy</td><td>Rejuvenate skin and support cellular health</td></tr>
</table>

<h3>Membership Tiers (Women's Pricing)</h3>
<table>
<tr><th>Tier</th><th>Monthly</th><th>Annual Fee</th><th>Key Features</th><th>Childcare</th><th>Classes</th></tr>
<tr><td>Silver — "The Foundation"</td><td class="price">$200/mo</td><td>$300</td><td>Full gym access, wet spa amenities (sauna, steam, salt room, cold plunge)</td><td>$75/mo add-on (2 hrs/day, 4 days/week)</td><td>À la carte or class credits</td></tr>
<tr><td>Gold — "The Enhanced Experience"</td><td class="price">$250/mo</td><td>$300</td><td>All Silver + Red Light Therapy 4x/mo, Dry Cryo 2x/mo</td><td>$75/mo add-on (2 hrs/day, 4 days/week)</td><td>À la carte or class credits</td></tr>
<tr><td>Platinum — "The Pinnacle of Luxury"</td><td class="price">$350/mo</td><td>$300</td><td>All Gold + Red Light Therapy 6x/mo, Dry Cryo 4x/mo</td><td>$75/mo add-on (2 hrs/day, 4 days/week)</td><td>À la carte or class credits</td></tr>
<tr><td>Diamond — "The Ultimate Commitment"</td><td class="price">$500/mo</td><td>$300</td><td>Full facility, 10 classes/mo included, Red Light 10x/mo, Dry Cryo 6x/mo, priority booking</td><td>$75/mo add-on (2 hrs/day, 4 days/week)</td><td>10 classes included monthly</td></tr>
</table>

<h3>Men's Rates (Hidden on site, but in code)</h3>
<table>
<tr><th>Tier</th><th>Monthly</th><th>Annual Fee</th></tr>
<tr><td>Silver</td><td>$120/mo</td><td>$175</td></tr>
<tr><td>Gold</td><td>$155/mo</td><td>$175</td></tr>
<tr><td>Platinum</td><td>$175/mo</td><td>$175</td></tr>
<tr><td>Diamond</td><td>Women only</td><td>—</td></tr>
</table>

<h3>Founding Member Privilege</h3>
<p>Apply now and pay your membership annually in advance to become one of our elite founding members. This status grants you a special founding member card, exclusive branded apparel, a premium gym bag, and priority access to all private events.</p>

<h3>Final CTA</h3>
<p><strong>Heading:</strong> Ready to Transform?</p>
<p>Select the membership tier that resonates with your vision of wellness and begin your journey at Storm Wellness Club.</p>
</div>

<!-- ==================== CLASSES ==================== -->
<div class="section">
<h2>Classes (/classes)</h2>

<h3>Hero</h3>
<p><strong>Heading:</strong> Class Schedule — Three Distinct Studios</p>
<p>A harmonious blend of mental clarity, emotional resilience, and physical strength. Choose your studio and discover the class that moves you.</p>

<h3>Reformer Pilates Studio (8 spots per class)</h3>
<ul>
<li>Reformer Sculpt – All Levels (heated) — Build strength and improve flexibility</li>
<li>Signature Flow Pilates – All Levels (heated/non-heated) — Flowing pilates movements on the reformer</li>
<li>Reformer Sculpt – Adv/Int (heated/non-heated) — Advanced reformer workout</li>
<li>Pilates Foundations – Beginner — Perfect for beginners learning reformer fundamentals</li>
<li>Pilates Flow – All Levels — Non-heated pilates flow for all levels</li>
</ul>

<h3>Cycling Studio (10 spots per class)</h3>
<ul>
<li>Cycle — Available 6AM-6PM Mon-Fri, 8AM-11AM weekends. High-energy rides with immersive lighting.</li>
</ul>

<h3>Aerobics Room (8 spots per class)</h3>
<ul>
<li>Buns of Steel (heated) — Lower body workout targeting glutes and legs</li>
<li>Vinyasa Yoga (heated) — Flowing yoga for flexibility and mindfulness</li>
<li>Mat Pilates (heated) — Core-focused mat pilates</li>
<li>Bootcamp Glutes — Intense bootcamp workout focused on glutes</li>
<li>Yoga Sculpt (heated) — Yoga with strength training elements</li>
<li>Bootcamp Full Body — Full body bootcamp for strength and cardio</li>
<li>Power Flow Yoga (heated) — Dynamic yoga for strength and flexibility</li>
<li>Core and Tone (heated) — Core workout for toning and strength</li>
</ul>
</div>

<!-- ==================== SPA ==================== -->
<div class="section">
<h2>Aella Spa (/spa)</h2>

<h3>Hero</h3>
<p><strong>Brand:</strong> Aella by Storm Wellness Club</p>
<p><strong>Heading:</strong> A Sanctuary for Renewal</p>
<p>Open to all—no membership required. Our holistic approach encompasses world-class treatments designed to support every step of your wellness journey.</p>
<p><strong>Member Discounts:</strong> Silver 5% OFF, Gold 8% OFF, Platinum 10% OFF, Diamond 12% OFF</p>

<h3>Body Rituals – Chakra Alignment</h3>
<table>
<tr><th>Service</th><th>Duration</th><th>Price</th><th>Description</th></tr>
<tr><td>Root Chakra Ritual</td><td>75 min</td><td class="price">$205</td><td>Grounding ritual focused on stabilizing the body and calming the nervous system. Lower body, feet, hips, breath guidance with warm oils.</td></tr>
<tr><td>Sacral Chakra Ritual</td><td>75 min</td><td class="price">$215</td><td>Sensory ritual to restore flow, emotional fluidity, and creative energy. Warm compresses, hip focus, gentle oil massage.</td></tr>
<tr><td>Solar Plexus Chakra Ritual ⭐</td><td>90 min</td><td class="price">$260</td><td>Transformative ritual activating core and energetic drive. Warming oils, infrared heat, abdominal work.</td></tr>
<tr><td>Heart Chakra Ritual</td><td>75 min</td><td class="price">$255</td><td>Calming ritual centered on chest, shoulders, upper body. Aromatic oils and sustained holds.</td></tr>
<tr><td>Throat Chakra Ritual</td><td>60 min</td><td class="price">$225</td><td>Neck, jaw, scalp focused ritual supporting communication and self-expression.</td></tr>
<tr><td>Third Eye Chakra Ritual</td><td>75 min</td><td class="price">$245</td><td>Meditative ritual centered on temples, scalp, face, and upper spine.</td></tr>
<tr><td>Crown Chakra Ritual (Integration) ⭐</td><td>90 min</td><td class="price">$295</td><td>Flagship ritual integrating full-body guided breath, warm oils, and rhythmic flow.</td></tr>
</table>

<h3>Body Wraps</h3>
<table>
<tr><th>Service</th><th>Duration</th><th>Price</th><th>Description</th></tr>
<tr><td>Detox Seaweed &amp; Charcoal Wrap</td><td>60 min</td><td class="price">$165</td><td>Purify skin and support body detoxification</td></tr>
<tr><td>Detox Seaweed &amp; Charcoal Wrap (Extended)</td><td>90 min</td><td class="price">$225</td><td>Full body detox with exfoliating scrub + relaxation massage</td></tr>
<tr><td>Anti-Aging Collagen Wrap ⭐</td><td>60 min</td><td class="price">$175</td><td>Improve elasticity, reduce dryness, support firmer skin</td></tr>
<tr><td>Anti-Aging Collagen Wrap (Extended)</td><td>90 min</td><td class="price">$235</td><td>Collagen infusion with full body scrub + massage</td></tr>
<tr><td>Brightening Vitamin C Wrap</td><td>60 min</td><td class="price">$165</td><td>Brighten, awaken, and even skin tone</td></tr>
<tr><td>Mud Therapy Wrap</td><td>60 min</td><td class="price">$160</td><td>Mineral mud to exfoliate and reduce inflammation</td></tr>
<tr><td>Hydration Boost Aloe Vera Wrap</td><td>60 min</td><td class="price">$155</td><td>Rehydrate and calm dry, irritated skin</td></tr>
<tr><td>Relaxing Chamomile Wrap</td><td>60 min</td><td class="price">$150</td><td>Reduce body tension and promote calmness</td></tr>
<tr><td>Nourishing Avocado &amp; Coconut Wrap</td><td>60 min</td><td class="price">$175</td><td>Restore hydration and soften skin</td></tr>
<tr><td>Coffee Sculpting Wrap</td><td>60 min</td><td class="price">$180</td><td>Caffeine-infused to stimulate circulation and improve firmness</td></tr>
</table>

<h3>Massage / Bodywork</h3>
<table>
<tr><th>Service</th><th>Duration</th><th>Price</th><th>Description</th></tr>
<tr><td>Storm Signature Massage</td><td>60 min</td><td class="price">$120</td><td>Calming full-body massage with slow rhythmic movements</td></tr>
<tr><td>Storm Signature Massage ⭐</td><td>90 min</td><td class="price">$155</td><td>Extended with lower body and neck focus</td></tr>
<tr><td>Deep Relief Massage</td><td>60 min</td><td class="price">$145</td><td>Deep-pressure bodywork for muscular tension</td></tr>
<tr><td>Deep Relief Massage ⭐</td><td>90 min</td><td class="price">$185</td><td>Extended muscular release with fascia attention</td></tr>
<tr><td>Sports Performance Massage</td><td>60 min</td><td class="price">$150</td><td>Athletic-focused with compression and stretching</td></tr>
<tr><td>Sports Performance Massage</td><td>90 min</td><td class="price">$195</td><td>Extended with joint mobility and fascia work</td></tr>
<tr><td>Lymph &amp; Flow Massage</td><td>60 min</td><td class="price">$160</td><td>Gentle rhythmic massage to stimulate lymph movement</td></tr>
<tr><td>Lymph &amp; Flow Massage</td><td>90 min</td><td class="price">$205</td><td>Extended with abdomen focus and scalp finishing</td></tr>
<tr><td>Prenatal Massage</td><td>60 min</td><td class="price">$165</td><td>Restorative prenatal-safe massage</td></tr>
<tr><td>Prenatal Massage</td><td>90 min</td><td class="price">$215</td><td>Extended with hip support and decompression</td></tr>
</table>

<h3>Facials</h3>
<table>
<tr><th>Service</th><th>Duration</th><th>Price</th><th>Description</th></tr>
<tr><td>Age-Defying Facial</td><td>60 min</td><td class="price">$175</td><td>Anti-aging with lifting, firming, advanced serums</td></tr>
<tr><td>Age-Defying Facial ⭐</td><td>90 min</td><td class="price">$215</td><td>Extended with deeper treatment and massage</td></tr>
<tr><td>Botanical Bliss Facial</td><td>60 min</td><td class="price">$160</td><td>Organic botanical extracts for sensitive skin</td></tr>
<tr><td>Botanical Bliss Facial</td><td>90 min</td><td class="price">$205</td><td>Extended with added exfoliation and massage</td></tr>
<tr><td>Customized Facial</td><td>60 min</td><td class="price">$165</td><td>Personalized to hydration, anti-aging, or sensitivity</td></tr>
<tr><td>Customized Facial</td><td>90 min</td><td class="price">$215</td><td>Extended tailored treatment with serum layering</td></tr>
<tr><td>Detoxifying Purity Facial</td><td>60 min</td><td class="price">$165</td><td>Deep cleansing for congested or acne-prone skin</td></tr>
<tr><td>Hydration Infusion Facial</td><td>60 min</td><td class="price">$160</td><td>Intense moisture with hyaluronic-rich products</td></tr>
<tr><td>Hydration Infusion Facial</td><td>90 min</td><td class="price">$205</td><td>Extended hydration with deeper absorption</td></tr>
<tr><td>Peptide Renewal Facial</td><td>60 min</td><td class="price">$175</td><td>Collagen production and skin renewal</td></tr>
<tr><td>Peptide Renewal Facial ⭐</td><td>90 min</td><td class="price">$225</td><td>Advanced serum layering and massage</td></tr>
<tr><td>Radiant Glow Facial</td><td>60 min</td><td class="price">$160</td><td>Gentle exfoliation and hydrating serums</td></tr>
<tr><td>Radiant Glow Facial</td><td>90 min</td><td class="price">$205</td><td>Enhanced exfoliation and prolonged massage</td></tr>
<tr><td>Vitamin C Brightening Facial</td><td>60 min</td><td class="price">$165</td><td>Target pigmentation, dullness, uneven tone</td></tr>
<tr><td>Vitamin C Brightening Facial</td><td>90 min</td><td class="price">$215</td><td>Extended with deeper exfoliation</td></tr>
</table>

<h3>Recovery</h3>
<table>
<tr><th>Service</th><th>Duration</th><th>Price</th><th>Member Price</th></tr>
<tr><td>Full-Body Red Light Therapy</td><td>10 min</td><td class="price">$18</td><td>$12</td></tr>
<tr><td>Full-Body Red Light Therapy ⭐</td><td>20 min</td><td class="price">$28</td><td>$20</td></tr>
</table>
</div>

<!-- ==================== AMENITIES ==================== -->
<div class="section">
<h2>Amenities (/amenities)</h2>

<h3>Hero</h3>
<p><strong>Heading:</strong> A Sanctuary of Wellness &amp; Luxury — Members Only</p>
<p>Every aspect of our space is designed with your holistic wellness in mind—nurturing body, mind, and spirit.</p>

<h3>Recovery Suite (Open Access, no booking needed)</h3>
<ul>
<li><strong>Infrared Sauna</strong> — Deep heat therapy for detoxification and muscle recovery</li>
<li><strong>Steam Room</strong> — Eucalyptus-infused steam for relaxation and respiratory wellness</li>
<li><strong>Cold Plunge</strong> — Cold therapy to boost circulation and reduce inflammation</li>
<li><strong>Salt Room</strong> — Himalayan salt therapy for respiratory health and skin rejuvenation</li>
</ul>

<h3>Advanced Recovery (Reservation Required)</h3>
<ul>
<li><strong>Red Light Therapy</strong> (20 min) — Cellular repair through precision wavelengths. Reduce inflammation, accelerate recovery, restore skin.</li>
<li><strong>Starpool ZeroBody</strong> (5 min) — Dry floatation in complete weightlessness. The nervous system resets. The mind follows.</li>
</ul>

<h3>Signature Classes</h3>
<ul>
<li><strong>Reformer Pilates</strong> — Precision-based movement on state-of-the-art reformers</li>
<li><strong>Cycling</strong> — High-energy rides, music-driven, instructor-led intensity</li>
<li><strong>Mat Pilates</strong> — Core-focused bodyweight training</li>
<li><strong>Strength &amp; Sculpt</strong> — Full-body conditioning combining weights and functional training</li>
</ul>

<h3>Lifestyle &amp; Comfort</h3>
<ul>
<li><strong>Luxury Locker Rooms</strong> — Spa-grade facilities with private showers, premium toiletries, plush towels</li>
<li><strong>Private Changing Suites</strong> — For members who prefer additional privacy</li>
<li><strong>Towel Service</strong> — Fresh, warm towels available throughout the club</li>
<li><strong>Complimentary Parking</strong> — Ample free parking for all members</li>
<li><strong>Storm Café</strong> — Fresh juices, smoothies, protein shakes, and healthy dining</li>
<li><strong>Kids Care</strong> — Supervised childcare while you enjoy your wellness experience (add-on)</li>
</ul>
</div>

<!-- ==================== KIDS CARE ==================== -->
<div class="section">
<h2>Kids Care (/kids-care)</h2>
<p><strong>Status:</strong> Coming Soon (soft launch)</p>
<p>Focus on your wellness while your little ones enjoy supervised activities. Available exclusively to members with a Kids Care Pass.</p>
<p><strong>Kids Care Pass:</strong> Each pass covers one child only.</p>

<h3>Features</h3>
<ul>
<li>Safe Environment — Fully supervised space with trained childcare professionals</li>
<li>Engaging Activities — Age-appropriate activities, crafts, and educational play</li>
<li>Flexible Hours — Available during peak workout hours</li>
<li>Small Groups — Low child-to-caregiver ratios for personalized attention</li>
</ul>

<h3>Hours</h3>
<ul>
<li>Monday - Thursday: 8:00 AM - 8:00 PM</li>
<li>Friday - Sunday: 8:00 AM - 5:00 PM</li>
</ul>

<h3>Two Rooms</h3>
<table>
<tr><th>Room</th><th>Age Groups</th><th>Capacity</th></tr>
<tr><td>Little Stars Room 🍼</td><td>Infants (3 months - 1 year), Toddlers (1 - 3 years)</td><td>8 children</td></tr>
<tr><td>Big Stars Room 🌟</td><td>Preschool (3 - 5 years), School Age (5 - 10 years)</td><td>6 children</td></tr>
</table>

<h3>Policies</h3>
<ul>
<li>Each Kids Care Pass is valid for one child only</li>
<li>Maximum 2-hour session per child per day</li>
<li>Parent/guardian must remain on premises</li>
<li>Children must be in good health</li>
<li>Cancellations must be made at least 2 hours in advance</li>
</ul>
</div>

<!-- ==================== GUEST PASS ==================== -->
<div class="section">
<h2>Guest Pass (/guest-pass)</h2>
<p><strong>Day Pass Price:</strong> <span class="price">$60</span></p>
<p>Full access to all club amenities for one day.</p>

<h3>Optional Add-Ons</h3>
<table>
<tr><th>Add-On</th><th>Price</th></tr>
<tr><td>Full Body Red Light Therapy — 10 min</td><td class="price">$18</td></tr>
<tr><td>Full Body Red Light Therapy — 20 min</td><td class="price">$28</td></tr>
<tr><td>ZeroBody Cryo</td><td class="price">$45</td></tr>
<tr><td>Reformer Pilates or Cycling — Single Class</td><td class="price">$40</td></tr>
<tr><td>Aerobics &amp; Other Studios — Single Class</td><td class="price">$30</td></tr>
</table>

<h3>Visit Interest Options</h3>
<ul>
<li>Movement &amp; Training</li>
<li>Recovery Therapies</li>
<li>Spa Amenities</li>
<li>Just exploring the space</li>
</ul>
</div>

<!-- ==================== CLASS PASSES ==================== -->
<div class="section">
<h2>Class Passes (/class-passes)</h2>

<h3>Reformer Pilates &amp; Cycling</h3>
<table>
<tr><th>Pass Type</th><th>Member Price</th><th>Non-Member Price</th></tr>
<tr><td>Single Class</td><td class="price">$25</td><td class="price">$30</td></tr>
<tr><td>10 Class Pack</td><td class="price">$170</td><td class="price">$285</td></tr>
</table>

<h3>Other Classes (Yoga, HIIT, Barre, Mat Pilates, Bootcamp, etc.)</h3>
<table>
<tr><th>Pass Type</th><th>Member Price</th><th>Non-Member Price</th></tr>
<tr><td>Single Class</td><td class="price">$20</td><td class="price">$30</td></tr>
<tr><td>10 Class Pack</td><td class="price">$150</td><td class="price">$180</td></tr>
</table>
</div>

<!-- ==================== CAFÉ ==================== -->
<div class="section">
<h2>Café (/cafe)</h2>
<p><strong>Heading:</strong> Nourish From Within — The Storm Café</p>
<p>Fuel your wellness journey with our carefully curated menu of fresh juices, smoothies, energy drinks, and healthy options.</p>
<p><em>Note: Menu items are database-driven and managed via admin panel. Categories include smoothies, protein shakes, acai bowls, cold-pressed juices, coffee, and healthy snacks. Items support dietary tags, calorie info, seasonal labels, and stock tracking.</em></p>
</div>

<!-- ==================== APPLY ==================== -->
<div class="section">
<h2>Apply for Membership (/apply)</h2>
<p>Multi-step application form with the following sections:</p>
<ol>
<li><strong>Personal Information</strong> — Name, DOB, gender, address, email, phone</li>
<li><strong>Membership Selection</strong> — Silver ($200), Gold ($250), Platinum ($350), Diamond ($500)</li>
<li><strong>Wellness Profile</strong> — Goals (weight loss, muscle gain, flexibility, stress reduction, holistic health), services interested in, motivations</li>
<li><strong>Payment Setup</strong> — Stripe card-on-file via SetupIntent (supports 3DS authentication)</li>
<li><strong>Agreements</strong> — Membership agreement PDF review and signature, credit card authorization, one-year commitment, payment acknowledgment</li>
<li><strong>Review &amp; Submit</strong></li>
</ol>
<p><strong>Founding Member Option:</strong> Pay annually in advance for founding member status with exclusive perks (branded apparel, premium gym bag, founding member card, priority access to events).</p>
<p>Application includes draft auto-save (localStorage + sessionStorage), progress tracking, and validation summary.</p>
</div>

<!-- ==================== FAQ ==================== -->
<div class="section">
<h2>FAQ (/faq)</h2>

<h3>Membership and Access</h3>
<dl>
<dt>How does the membership application process work?</dt>
<dd>Our membership process begins with a brief application. After submission, our team reviews and contacts you within 48 hours to schedule a personalized tour. During your tour, we discuss membership options and find the perfect plan for your lifestyle.</dd>
<dt>Can I visit before applying?</dt>
<dd>Yes! Day passes are available for $60 with full access to facilities, group classes, spa amenities, and café.</dd>
</dl>

<h3>Childcare Services</h3>
<dl>
<dt>What childcare services do you offer?</dt>
<dd>Kids Care provides supervised care for children ages 6 months to 12 years with age-appropriate activities, games, and educational play.</dd>
</dl>

<h3>Spa and Wellness</h3>
<dl>
<dt>Are spa services available to non-members?</dt>
<dd>Yes! Aella Spa is open to the public. Non-members can book massage, body treatments, red light therapy, and cryotherapy.</dd>
</dl>

<h3>Cafe</h3>
<dl>
<dt>Do you have dining options on-site?</dt>
<dd>Yes! Our café offers smoothies, protein shakes, grab-and-go meals, and light bites crafted with wholesome ingredients.</dd>
</dl>

<h3>Facilities and Access</h3>
<dl>
<dt>Do you offer guest passes?</dt>
<dd>Day passes are $60 with full access to all club amenities for one day. Members can purchase for guests at the front desk.</dd>
</dl>
</div>

<!-- ==================== PROTECTED AREAS ==================== -->
<div class="section">
<h2>Protected Areas (require authentication)</h2>
<ul>
<li><strong>/member/*</strong> — Member dashboard, profile, bookings, credits, wellness tracking, payment methods, health score, achievements, workouts, habits, goals</li>
<li><strong>/portal/*</strong> — Non-member class portal: bookings, passes, payment methods, profile</li>
<li><strong>/admin/*</strong> — Staff admin panel: member management, check-in, classes, scheduling, payments, reports, café POS, spa appointments, equipment, marketing, email management</li>
</ul>
</div>

<!-- ==================== BUSINESS INFO ==================== -->
<div class="section">
<h2>Business Information</h2>
<ul>
<li><strong>Name:</strong> Storm Wellness Club</li>
<li><strong>Spa Brand:</strong> Aella by Storm Wellness Club</li>
<li><strong>Location:</strong> Dearborn, Michigan</li>
<li><strong>Type:</strong> Premium wellness &amp; fitness club</li>
<li><strong>Website:</strong> https://www.stormwellnessclub.com</li>
<li><strong>Membership Model:</strong> Application-based, tiered (Silver/Gold/Platinum/Diamond)</li>
<li><strong>Payment:</strong> Stripe integration</li>
</ul>
</div>

</body>
</html>`;
