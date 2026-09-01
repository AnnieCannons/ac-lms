/**
 * LMS student accounts that will never have a matching Airtable record — either
 * QA/test accounts (kept for testing, not real students) or real accounts we've
 * confirmed aren't actionable (graduated, or otherwise no longer being tracked).
 * Used to keep the weekly Slack report and the Airtable-matching script's "still
 * unmatched" list free of permanent, known non-matches.
 */
export const EXCLUDED_STUDENT_USER_IDS = new Set([
  'f2736067-f31b-4c8c-adaf-aeb8b225e260', // RaiStudent (rai+1@anniecannons.com) — test account
  '378e107f-5a14-4de5-ac20-bb34ce0b936c', // HaniyaStudent (haniya+1@anniecannons.com) — test account
  '0fd8a4ca-5760-4fe8-bc7b-14452fe5316b', // FlashcardTestStudent (rai+2@anniecannons.com) — test account
  '2f2323bd-d0b4-4da8-8a8d-225064a851c4', // Readiness Test Student (catiehart+readiness@mac.com) — test account
  '26d0fef7-64b1-4da7-a9e1-a5b185add4d1', // catie student (catiehart@mac.com) — test account
  'c2b2cda3-57e0-4951-93f5-466ebb18635a', // Dawn TEST (dawnallenweb@gmail.com) — test account
  // Auto-generated QA accounts (@gptmail.ca / @gptmail.me)
  '91527734-a21c-475b-9bf0-55e6add959c2', // shunt_1782343049_5b65
  '3e19a89e-d78c-4c3f-8b10-ce08d34744fe', // hunt_1782366832_aa75
  '393f6c4e-2137-4d31-9f24-b9324e34b1b1', // shunt_1782572764_6fae
  '10e8dcca-bc0d-4342-9905-18390e998203', // shunt_1782979326_6dc9
  '3741d459-2ea4-4f39-a205-9cd1746ef4df', // shunt_1783515810_d48a
  '2eaec02d-d23a-45b5-83de-169370882552', // shunt_1783764931_b9b2
  '493a032b-dd33-4666-a259-3361c8ec2e41', // hunter_r26_1783941706_19d2
  '29fdf421-0fd9-4665-a187-55a2474630aa', // shunt_1782220279_3592
  '673cc9c8-523f-4aa0-b2ba-4d278689042d', // shunt_1782353812_4151
  '30c8011c-0ef0-44cd-b488-0dd90553ead2', // shunt_1782536704_b924
  'fa7e4166-c8a9-47d7-b203-43a819d35f72', // shunt_1782817305_4c09
  '52fedb6f-3dbb-4074-ad7c-2707f94c7419', // shunt_1783065799_b311
  'eb01fa12-bb89-4a51-a0a1-54859973a5bb', // shunt_1783591398_b9ba
  '99f45624-6821-4875-85bb-c8862ffb8991', // hunter_r24_1783926771_09b1
  'f8527e88-1abc-4f30-96a4-489270a80cca', // shunt_1782366629_909c
  '152ebf77-ecee-4139-bfb8-69a97701218f', // shunt_1782540606_50c6
  'ec12931e-f51b-44bb-bc6f-7cdec8fc2ef9', // shunt_1782900097_97ee
  '68a9564f-d855-4d9c-a2eb-83b2e82919ea', // shunt_1782900118_efe8
  'bb4e1286-6fdd-41a7-910e-663e45ec91d5', // shunt_1783123342_8503
  '19235200-32be-4755-ab76-a187d40c1fc0', // shunt_1783627299_2f16
  '64313819-d214-40ba-9161-d2a76fa262bf', // hunter_r25_1783937418_34e6
  // Real accounts confirmed not actionable
  'd6985f6a-3562-4496-86d3-4720863f8668', // Ainslie (ainslie@anniecannons.com) — used while acting as a TA, no longer active; the real ongoing Ainslie account is ainsliefrancisdec16@gmail.com
  'f3d70cec-d6fd-4f5f-837d-2073040632f7', // Jenny (jencvon@gmail.com) — graduated
  'cccce8d6-0cc0-4650-bd62-fb6db5def278', // Tessa (tessa@edifyanother.com)
  '4ca07f37-0c3b-4706-9478-91715052575f', // Yani (yanilove8914@gmail.com)
  '43917ca3-bbb7-4a11-ad46-a7ec5e61d8bc', // Cheyenne (cheytdraw25@gmail.com)
  '0265d6a0-67b1-44e6-8a44-711140f748ce', // Aria (sowder.aria@gmail.com)
])
