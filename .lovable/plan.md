# Cafe menu: reorder + image cleanup review

## 1. Category reorder (Cafe section)

Group the three smoothie/blended categories together at the very top, before Cafe Bites and everything else. Coffee & Lattes / Matcha stay after.

New order:

1. Functional Smoothie
2. Protein Smoothie
3. Amino Acid Slushie
4. Cafe Bites
5. Cold Pressed Juice
6. Refreshers
7. Energy Drinks
8. Water
9. Coffee & Lattes
10. Matcha

Inactive categories (Toast, Shots, Preworkout, blank "", Fruit Cups) stay inactive and are not shown.

## 2. Image gallery — you pick keep vs. remove

**No image changes are made in this step.** These are all 16 currently-live images across active cafe items. Open each URL, then reply with the list of ones to remove (or "keep all"). I will not touch any image until you confirm.

### Functional Smoothie
- **Orange Creamsicle** — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/60c782c6-14a4-480a-bc33-c720989277cd.jpeg
- **Coconut Cloud** — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/eb219b42-2810-43af-8e72-5087c3ff9bd9.png
- **Hailey Bieber Smoothie** (Strawberry Glaze) — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/5542656f-587a-4ab3-b06a-2c70f0b80edd.jpeg

### Cafe Bites
- **Mediterranean mezze** — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/e04525bf-0fd9-453c-b8f7-a8c40402a14b.jpeg
- **Mediterranean Mezze (sm)** — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/d360edf2-6165-443b-add7-e0ce7515a806.jpeg
- **Garden Avocado Toast** — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/8692790f-5c52-42be-9cbc-b322f2c335f2.jpeg
- **Acai Bowl** (image 1 of 2) — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/0ef21d87-5c89-42f6-82f1-38b6f46d00cd.jpeg
- **Acai Bowl** (image 2 of 2) — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/bf6cae35-d04c-415b-91bc-eb8ff7073a05.jpeg
- **Labneh Toast** — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/a836a9c7-c50d-4a45-871c-1c2a0bee193c.jpeg
- **Turkey Melt** — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/a193a42d-b9b5-44ef-8566-eecd6669d7c2.jpeg

### Coffee & Lattes
- **Dalgona Whipped Nescafe** — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/ba6fd831-89c8-4fab-919f-082c1987e029.jpeg
- **Latte** (image 1 of 2) — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/497fea9e-3c6b-4868-8c59-4d236d6b1788.jpeg
- **Latte** (image 2 of 2) — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/e6b41ed1-e48e-4f0e-9a4d-8cec13d5de1a.jpeg

### Matcha
- **Matcha** — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/9ff44ebd-6ffa-47f4-9a54-c4a340cbe283.jpeg
- **Honey Comb Matcha** (Vanilla) — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/2604a326-3d75-4d99-a112-145b755a9e55.jpeg
- **Strawberry Matcha** — https://cqzmrdzwgsujgbjqpoxh.supabase.co/storage/v1/object/public/cafe-menu-images/145ff508-6617-4530-90b8-2495b29b90e2.jpeg

### Items with NO image (active) — flag for future
Colostrum & Saffron Chia (all 4 flavors), Coconut Mango Sago, Baked Organic Eggs With Chips, Protein Yogurt Power Bowl, Digestive Fruit Bowl, Tuna Melt, Protein Yogurt With Chia Pudding — plus every item in Cold Pressed Juice, Water, Energy Drinks, Protein Smoothie, Amino Acid Slushie, Refreshers. We can address these once the keep/remove list is set.

## Technical details

- Reorder is a single UPDATE on `cafe_menu_categories.display_order` for the 10 active cafe rows above; no schema change.
- Image removal (once you list URLs) will null out `image_url` / prune from `image_urls` array on the matching `cafe_menu_items` row, and delete the object from the `cafe-menu-images` storage bucket.

## Next step

Reply with either "keep all" or the specific images to remove (item name is enough, e.g. "remove Latte image 2, remove Acai Bowl image 2"). Then I'll apply the reorder and any deletions in one pass.
