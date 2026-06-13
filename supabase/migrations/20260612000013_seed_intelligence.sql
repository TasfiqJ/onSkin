-- =============================================================================
-- 0013 · Seed: starter conflict matrix (docs/02 §4.4/§4.8) + PAO defaults (§6)
-- =============================================================================
-- The ~14 validated starter rules from docs/02 §4.4/§4.8, authored in the
-- source-of-truth doc. EVERY row is reviewed_by = NULL.
--   *** BLOCKED: B-DERM-REVIEW — NO conflict rule (especially any `safety` row)
--   *** ships to users until a board-certified dermatologist + a cosmetic
--   *** chemist/pharmacist sign off and `reviewed_by` is populated. This gates
--   *** launch of the intelligence layer (docs/02 §9, mandatory not optional).
--
-- Rule IDs are FIXED here and mirrored in the client's bundled fallback ruleset
-- (apps/mobile/src/features/intelligence/rules.ts) so routine_conflicts.rule_id
-- is consistent whether detection runs from cached-DB rules or the offline copy.
-- Keep the two in sync; the matrix changes only via versioned, derm-reviewed events.
--
-- Safety rules use the profile-derived pseudo-tag 'pregnancy' (the engine injects
-- it when skin_profiles.pregnancy_status is pregnant/breastfeeding).

insert into public.conflict_rules
  (id, tag_a, tag_b, interaction_type, base_severity, evidence_grade, evidence_label, mechanism, resolution_type, resolution_copy, applies_when, source_citation, rule_version, reviewed_by, is_active)
values
  ('00000000-0000-4000-8000-000000000001', 'retinoid', 'aha', 'irritation', 'mild', 'C', 'contested',
   'Both speed surface turnover; used together they can over-exfoliate and stress the barrier, especially on sensitive skin. The idea that they cancel each other out is not well supported.',
   'alternate_nights', 'Alternate nights — keep retinol and your acid on different evenings.', null,
   'Paula''s Choice; Westlake/London Derm; Glow Recipe (Dr. H. King)', 1, null, true),

  ('00000000-0000-4000-8000-000000000002', 'retinoid', 'bha', 'irritation', 'mild', 'C', 'contested',
   'As with AHAs, combining can compound irritation; some dermatologists consider retinoid + BHA potentially complementary for oilier skin.',
   'alternate_nights', 'Alternate nights — though oilier, resistant skin may tolerate co-use.', '{"co_use_if":"resistant"}',
   'Glow Recipe (Dr. King); Paula''s Choice', 1, null, true),

  ('00000000-0000-4000-8000-000000000003', 'benzoyl_peroxide', 'retinoid', 'stability', 'moderate', 'C', 'established',
   'Benzoyl peroxide is an oxidiser and can break simple retinol/tretinoin down on contact. Adapalene and encapsulated retinoids resist this.',
   'separate_am_pm', 'Use benzoyl peroxide in the morning and your retinoid at night.', '{"subflag_exempt":["adapalene","encapsulated"]}',
   'Martin et al., Br. J. Dermatol. 1998', 1, null, true),

  ('00000000-0000-4000-8000-000000000004', 'niacinamide', 'vitamin_c', 'myth', 'none', null, 'refuted',
   'The flushing fear came from a 1960s study using niacin (not niacinamide) under heat. Niacinamide is stable and the two are routinely combined; they can even complement each other (brightening + barrier support).',
   'reassure', 'These work well together — no need to separate them.', null,
   'Clinikally; dermatology consensus', 1, null, true),

  ('00000000-0000-4000-8000-000000000005', 'vitamin_c', 'aha', 'irritation', 'mild', 'C', 'contested',
   'Chemically compatible (both favour a low pH), but doubling up potent actives can increase irritation.',
   'separate_am_pm', 'Use vitamin C in the morning and your acid in the evening.', null,
   'Schweiger Derm (Dr. Sue Ann Wee); commercial C+AHA products', 1, null, true),

  ('00000000-0000-4000-8000-000000000006', 'copper_peptide', 'vitamin_c', 'stability', 'mild', 'C', 'plausible',
   'Copper can speed up vitamin C oxidation, so layering them together may make the vitamin C less effective over time.',
   'separate_am_pm', 'Vitamin C in the morning, copper peptides at night.', null,
   'cosmetic-chemistry consensus', 1, null, true),

  ('00000000-0000-4000-8000-000000000007', 'copper_peptide', 'aha', 'stability', 'mild', 'C', 'plausible',
   'Low-pH acids can destabilise peptides, so they are best kept apart.',
   'separate_am_pm', 'Keep copper peptides and acids in separate routines.', null,
   'cosmetic-chemistry consensus', 1, null, true),

  ('00000000-0000-4000-8000-000000000008', 'aha', 'bha', 'irritation', 'moderate', 'C', 'plausible',
   'Stacking several exfoliating acids in one session raises the chance of over-exfoliation and a stressed barrier.',
   'lower_frequency', 'Avoid using more than one acid in the same session.', null,
   'dermatology consensus', 1, null, true),

  ('00000000-0000-4000-8000-000000000009', 'vitamin_c', 'sunscreen', 'synergy', 'none', 'C', 'plausible',
   'Antioxidant plus UV protection is a classic morning pairing.',
   'no_change', 'A great morning pair — vitamin C under your SPF.', null,
   'dermatology consensus', 1, null, true),

  ('00000000-0000-4000-8000-00000000000a', 'niacinamide', 'retinoid', 'synergy', 'none', 'C', 'plausible',
   'Niacinamide supports the barrier and can temper the dryness some people get from a retinoid.',
   'no_change', 'These complement each other — niacinamide can ease retinoid dryness.', null,
   'dermatology consensus', 1, null, true),

  ('00000000-0000-4000-8000-00000000000b', 'retinoid', 'pregnancy', 'safety', 'high', 'C', 'contested',
   'Many dermatologists suggest pausing topical retinoids while pregnant or breastfeeding, out of caution.',
   'avoid_refer', 'Many dermatologists suggest pausing retinoids while pregnant or breastfeeding. This is a conversation for you and your doctor — we''ve set it aside for now and can suggest a gentler alternative.',
   '{"pregnancy":true}', 'AAD-aligned expert consensus; dermatology pregnancy/lactation reviews', 1, null, true),

  ('00000000-0000-4000-8000-00000000000c', 'bha', 'pregnancy', 'safety', 'moderate', 'C', 'contested',
   'High-dose salicylic acid is on common pregnancy-caution lists; low-dose cosmetic BHA is generally considered fine.',
   'avoid_refer', 'High-strength salicylic acid is often paused in pregnancy. Please check with your doctor — we''ve set it aside for now.',
   '{"pregnancy":true,"requires_high_dose":true}', 'pregnancy-safe-skincare consensus', 1, null, true),

  ('00000000-0000-4000-8000-00000000000d', 'hydroquinone', 'pregnancy', 'safety', 'high', 'C', 'contested',
   'Cosmetic hydroquinone use is generally avoided during pregnancy and breastfeeding.',
   'avoid_refer', 'Hydroquinone is usually paused in pregnancy and breastfeeding. Please check with your doctor — we''ve set it aside for now.',
   '{"pregnancy":true}', 'dermatology lactation reviews', 1, null, true);

-- Category PAO defaults (docs/02 §6). Conservative starting values — final numbers
-- to be confirmed by the cosmetic chemist (BLOCKED: B-DERM-REVIEW).
insert into public.ingredient_pao_defaults (category, default_pao_months, rationale) values
  ('vitamin_c_serum', 4,  'ascorbic acid oxidises quickly once opened/air-exposed'),
  ('mascara',         4,  'eye-area microbial risk'),
  ('eye_liquid',      4,  'eye-area microbial risk'),
  ('benzoyl_peroxide',6,  'oxidiser; potency decay'),
  ('spf',             12, 'OTC drug — prefer the printed expiry date'),
  ('serum',           9,  'water-based, preservative-dependent'),
  ('toner',           9,  'water-based, preservative-dependent'),
  ('moisturiser_tube',12, 'typical'),
  ('moisturiser_jar', 8,  'finger-dipping contamination'),
  ('oil_balm',        18, 'low water activity'),
  ('cleanser',        12, 'rinse-off');
