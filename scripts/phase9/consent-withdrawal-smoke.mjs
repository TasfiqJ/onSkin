#!/usr/bin/env node
import { block, printResult, read, warn } from './lib.mjs';

const errors = [];
const warnings = [];

const settings = read('apps/mobile/src/features/settings/actions.ts');
const you = read('apps/mobile/src/app/(tabs)/you.tsx');
const trend = read('apps/mobile/src/features/trend/consent.ts');
const community = read('apps/mobile/src/features/community/consent.ts');
const commerce = read('apps/mobile/src/features/commerce/consent.ts');
const ask = read('apps/mobile/src/features/ask/consent.ts');
const migrations = read('supabase/migrations/20260613000023_community.sql') + read('supabase/migrations/20260614000025_ask_onskin.sql');

block(errors, /withdrawHealthDataConsent/.test(settings), 'Health-data consent withdrawal action is missing.');
block(errors, /granted:\s*false/.test(settings) && /deleteAccount/.test(settings), 'Health-data withdrawal must record false consent and delete account data.');
block(errors, /recordConsent/.test(you) && /granted/.test(you) && /setCommerceConsentLocal/.test(you), 'Settings consent toggles must record ledger rows and sync commerce local flag.');

block(errors, /revokeTrendInsightsConsent/.test(trend), 'Trend consent revocation function is missing.');
block(errors, /deleteTrendState/.test(trend), 'Trend consent revocation must delete local trend state.');
block(errors, /photo_trend_insights/.test(trend) && /granted:\s*false/.test(trend), 'Trend consent revocation must record a false ledger row.');

block(errors, /withdrawCommunityConsent/.test(community), 'Community consent withdrawal function is missing.');
block(errors, /community_participation/.test(community) && /granted:\s*false/.test(community), 'Community consent withdrawal must record a false ledger row.');
block(errors, /community_questions.*on delete cascade/s.test(migrations), 'Community questions must cascade on account deletion.');
block(errors, /community_reactions.*on delete cascade/s.test(migrations), 'Community reactions must cascade on account deletion.');

block(errors, /data_sharing/.test(commerce), 'Commerce must use the data_sharing consent type.');
block(errors, /declineCommerceConsent/.test(commerce) && /setCommerceConsentLocal\(false\)/.test(commerce), 'Commerce decline must relock local paid-link affordance.');

block(errors, /revokeAskConsent/.test(ask), 'Ask consent revocation function is missing.');
block(errors, /clearAskStore/.test(ask), 'Ask consent revocation must clear local Ask state.');
block(errors, /ask_onskin/.test(ask) && /granted:\s*false/.test(ask), 'Ask consent revocation must record a false ledger row.');
block(errors, /ask_safety_audit.*on delete cascade/s.test(migrations), 'Ask safety audit must cascade on account deletion.');

warn(warnings, process.env.PHASE9_CONSENT_WITHDRAWAL_PASS === 'true', 'Missing live consent-withdrawal evidence: PHASE9_CONSENT_WITHDRAWAL_PASS=true.');

printResult('Phase 9 consent withdrawal smoke', errors, warnings);
