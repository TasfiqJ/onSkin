import type { DetectedConflict } from '@/features/intelligence/engine';
import { BRAND } from '@/lib/brand';
import { env } from '@/lib/env';

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

const finalDomain = env.finalBrandDomain.trim();
const finalDomainReady = finalDomain.length > 0 && !/example\.com/i.test(finalDomain);
const productionSurfaceReady = env.appEnvironment !== 'production' || finalDomainReady;

export const phase7Flags = {
  finalDomainReady,
  productionSurfaceReady,
  commerce: env.phase7CommerceEnabled && finalDomainReady,
  communityPosting: env.phase7CommunityPostingEnabled && productionSurfaceReady,
  trend: env.phase7TrendEnabled && productionSurfaceReady,
  cloudAsk: env.phase7CloudAskEnabled && productionSurfaceReady,
  widgets: env.phase7WidgetsEnabled && productionSurfaceReady,
  shareCard:
    env.phase7ShareCardEnabled &&
    env.phase7ReviewedConflictSharingEnabled &&
    env.phase8PublicLinksEnabled &&
    productionSurfaceReady &&
    finalDomainReady,
  goalActiveRecommendations: env.phase7GoalActiveRecommendationsEnabled && productionSurfaceReady,
} as const;

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
    body: 'Skin Notes can stay read-only. Asking or aggregate peer features need moderation, legal review, and enough density to be useful.',
    detail:
      'No user post is accepted until the review desk and consent copy are production-approved.',
    cta: 'Back',
  },
  trend: {
    title: 'Photo trend insights are not in this beta',
    body: 'The photo timeline stays local-first and score-free. Trend narratives need device QA, fairness review, and final consent copy.',
    detail: 'Progress photos remain useful without estimated scores or change claims.',
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
    body: 'Today check-offs and reminders ship inside the app first. Home-screen widgets and live activity controls need native device QA.',
    detail: 'The beta should prove the core habit loop before adding OS-level surfaces.',
    cta: 'Back',
  },
  shareCard: {
    title: 'Share cards are not ready yet',
    body: 'A card can be shared only for a real owned-product interaction backed by a reviewed rule and final brand domain.',
    detail: 'This prevents unreviewed ingredient guidance from becoming a growth artifact.',
    cta: 'Back',
  },
  goalActiveRecommendations: {
    title: 'Goal-active suggestions are not in this beta',
    body: 'Structural routine gaps can ship. New active-ingredient suggestions need clinical review and source-cleared catalog support.',
    detail:
      'The recommendation engine stays useful without pushing medical-adjacent actives early.',
    cta: 'Back',
  },
};

export function isPhase7SurfaceEnabled(surface: DeferredSurfaceKind): boolean {
  return SURFACE_TO_FLAG[surface];
}

export function isReviewedConflict(conflict: DetectedConflict | null | undefined): boolean {
  return Boolean(conflict?.rule.reviewedBy);
}

export function canShareConflictCard(
  conflict: DetectedConflict | null | undefined,
): conflict is DetectedConflict {
  if (!phase7Flags.shareCard || !conflict || !isReviewedConflict(conflict)) return false;
  return (
    conflict.rule.interactionType !== 'safety' &&
    conflict.rule.tagA !== 'pregnancy' &&
    conflict.rule.tagB !== 'pregnancy' &&
    Boolean(conflict.productAId) &&
    Boolean(conflict.productBId) &&
    Boolean(conflict.productAName) &&
    Boolean(conflict.productBName)
  );
}
