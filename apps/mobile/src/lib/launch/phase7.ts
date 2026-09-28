import { BRAND } from '@/lib/brand';
import { env } from '@/lib/env';
import { normalizePublicDomain } from '@/lib/growth/attribution';

export type DeferredSurfaceKind =
  | 'commerce'
  | 'communityPosting'
  | 'trend'
  | 'cloudAsk'
  | 'widgets'
  | 'shareCard'
  | 'goalActiveRecommendations';

export type DeferredSurfaceCopy = {
  title: string;
  body: string;
  detail: string;
  cta: string;
};

const finalDomainReady = Boolean(normalizePublicDomain(env.finalBrandDomain));
const productionSurfaceReady = env.appEnvironment !== 'production' || finalDomainReady;

// Environment flags can expose only capabilities that actually exist in the
// release binary. These literals are intentionally not environment-driven:
// commerce has no approved retailer rail or launch evidence, widget source is
// build-gated until lifecycle and device proof are complete, community has no
// submission/moderation or aggregate-data path, and Trend has no validated
// engine. Keeping those facts
// here prevents a release configuration mistake from turning previews,
// placeholder data, or consent scaffolding into a customer-facing promise.
export const phase7Capabilities = Object.freeze({
  commerce: false,
  communityQuestionSubmission: false,
  communityAggregates: false,
  trendEngine: false,
  nativeWidgets: false,
  conflictSharePublication: false,
} as const);

// Lean V1: deployment flags cannot reopen deferred customer surfaces.
export const phase7Flags = Object.freeze({
  finalDomainReady,
  productionSurfaceReady,
  commerce: false,
  communityPosting: false,
  communityAggregates: false,
  trend: false,
  cloudAsk: false,
  widgets: false,
  shareCard: false,
  goalActiveRecommendations: false,
} as const);

const SURFACE_TO_FLAG: Record<DeferredSurfaceKind, boolean> = {
  commerce: phase7Flags.commerce,
  communityPosting: phase7Flags.communityPosting,
  trend: phase7Flags.trend,
  cloudAsk: phase7Flags.cloudAsk,
  widgets: phase7Flags.widgets,
  shareCard: phase7Flags.shareCard,
  goalActiveRecommendations: phase7Flags.goalActiveRecommendations,
};

export const deferredSurfaceCopy: Record<DeferredSurfaceKind, DeferredSurfaceCopy> = {
  commerce: {
    title: 'Where-to-buy is not in this beta',
    body: 'Recommendations stay type-first until the catalog, paid-link rail, legal disclosure, and brand gates are cleared.',
    detail:
      'This keeps money out of the decision engine while the core routine loop is being validated.',
    cta: 'Back',
  },
  communityPosting: {
    title: 'Community posting is not in this beta',
    body: 'Community and Skin Notes are deferred from V1. No questions or posts are collected here.',
    detail:
      'No consent or question is collected until moderation, support, appeals, persistence, and legal review are ready.',
    cta: 'Back',
  },
  trend: {
    title: 'Photo trend insights are not in this beta',
    body: 'The photo timeline stays local-first and score-free. No validated trend engine ships in this release.',
    detail: 'No Trend consent is requested. Progress photos remain useful without change claims.',
    cta: 'Back',
  },
  cloudAsk: {
    title: `${BRAND.askName} is not in this beta`,
    body: 'The launch loop focuses on shelf, conflicts, routines, photos, reminders, payments, and privacy controls.',
    detail:
      'A cloud advisor needs final privacy copy, model policy review, support handling, and observability before it can ship.',
    cta: 'Back',
  },
  widgets: {
    title: 'Widgets are not in this beta',
    body: 'Today check-offs and reminders work inside the app. This build does not enable a customer-ready home-screen widget or Live Activity.',
    detail:
      'Native source stays gated until lifecycle, privacy, signed-binary, and physical-device evidence pass. This route offers no preview, OS control, or paid widget upgrade.',
    cta: 'Back',
  },
  shareCard: {
    title: 'Share cards are not ready yet',
    body: 'No shelf-check card or public link is admitted for sharing in this build.',
    detail:
      'Sharing needs separate reviewed publication authority, a private-data-safe card, and your confirmation of the exact card first.',
    cta: 'Back',
  },
  goalActiveRecommendations: {
    title: 'Product recommendations are deferred',
    body: 'V1 helps you build a routine around the products you already own. Product discovery and new active suggestions are not included.',
    detail: 'Add your existing products from Shelf to continue with your routine.',
    cta: 'Back',
  },
};

export function isPhase7SurfaceEnabled(surface: DeferredSurfaceKind): boolean {
  return SURFACE_TO_FLAG[surface];
}

export function canShareConflictCard(_conflict?: unknown): false {
  return false;
}
