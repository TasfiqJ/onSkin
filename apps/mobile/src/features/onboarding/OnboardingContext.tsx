import type { GoalId } from '@layerwell/types';
import { useQueryClient } from '@tanstack/react-query';
import { NavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ContextType,
  type ReactNode,
} from 'react';

import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
  runHealthDataWriteOperation,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  activeHealthProcessingLeaseSnapshot,
  subscribeActiveHealthProcessingLeaseChanges,
} from '@/lib/consent/healthProcessingEpoch';
import { getPersistedSupabaseUser, supabase } from '@/lib/supabase/client';
import {
  getQuizCompletionState,
  ONBOARDING_QUIZ,
  scoreQuiz,
  type QuizAnswers,
  type ScoredQuizProfileResult,
} from './quiz';
import { setStoredSkinProfileFromExplicitQuiz } from './skinProfileStore';
import { hasCurrentHealthDataCollectionConsent } from './healthConsentStore';

type PrivacyStatus = 'checking' | 'ready' | 'denied';
type OnboardingContextValue = {
  goals: GoalId[];
  quizAnswers: QuizAnswers;
  profileResult: ScoredQuizProfileResult | null;
  privacyStatus: PrivacyStatus;
  draftGeneration: number | null;
  isCurrent: () => boolean;
  toggleGoal: (id: GoalId) => void;
  setAnswer: (questionId: string, value: string | string[]) => void;
  computeResult: () => ScoredQuizProfileResult;
  persistSkinProfile: () => Promise<ScoredQuizProfileResult>;
  reset: () => void;
};
type Draft = {
  lease: HealthDataWriteLease;
  goals: GoalId[];
  quizAnswers: QuizAnswers;
  profileResult: ScoredQuizProfileResult | null;
  revision: number;
  save: Promise<ScoredQuizProfileResult> | null;
};
type ProviderValue = OnboardingContextValue & {
  revision: number;
  generation: number | null;
  admissionToken: number;
  revalidate: (fresh?: boolean) => Promise<HealthDataWriteLease | null>;
};
const MAX_GOALS = 2;
const EMPTY_GOALS: GoalId[] = Object.freeze([]) as unknown as GoalId[];
const EMPTY_ANSWERS: QuizAnswers = Object.freeze({});
const OnboardingContext = createContext<ProviderValue | undefined>(undefined);
function closed(): never {
  throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
}

// Per-provider external memory: React updates carry only a version number.
// Authority retirement mutates this private session synchronously, before React commits.
function createOnboardingSession(queryClient: ReturnType<typeof useQueryClient>) {
  let version = 0;
  const listeners = new Set<() => void>();
  let mounted = true;
  let draft: Draft | null = null;
  let status: PrivacyStatus = 'checking';
  let checkToken = 0;
  let pending: Promise<HealthDataWriteLease | null> | null = null;
  function refresh() {
    if (mounted) {
      ++version;
      for (const listener of [...listeners]) listener();
    }
  }
  function retire() {
    // Clear the retired object too: old closures cannot retain a usable draft.
    if (draft) {
      draft.goals = EMPTY_GOALS;
      draft.quizAnswers = EMPTY_ANSWERS;
      draft.profileResult = null;
      draft.revision++;
      draft.save = null;
    }
    draft = null;
    ++checkToken;
    pending = null;
    status = 'denied';
  }
  function revalidate(fresh = false): Promise<HealthDataWriteLease | null> {
    if (!mounted) return Promise.resolve(null);
    let lease: HealthDataWriteLease;
    try {
      lease = captureHealthDataWriteLease();
    } catch {
      retire();
      refresh();
      return Promise.resolve(null);
    }
    if (draft?.lease.generation !== lease.generation) {
      retire();
      draft = {
        lease,
        goals: EMPTY_GOALS,
        quizAnswers: EMPTY_ANSWERS,
        profileResult: null,
        revision: 0,
        save: null,
      };
    }
    if (pending && !fresh) return pending;
    const accepted = draft!;
    const token = ++checkToken;
    status = 'checking';
    refresh();
    const check = (async () => {
      try {
        const consent = await runHealthDataWriteOperation(lease.ownerUserId, async (operation) => {
          assertHealthDataWriteLease(lease);
          const currentConsent = await hasCurrentHealthDataCollectionConsent();
          operation.assertCurrent();
          assertHealthDataWriteLease(lease);
          return currentConsent;
        });
        if (!mounted || token !== checkToken || draft !== accepted) return null;
        assertHealthDataWriteLease(lease);
        if (!consent) throw new Error('CURRENT_HEALTH_CONSENT_REQUIRED');
        status = 'ready';
        // Admission itself retires functions rendered while the check was pending.
        pending = null;
        ++checkToken;
        return lease;
      } catch {
        if (mounted && token === checkToken) retire();
        return null;
      } finally {
        if (token === checkToken) pending = null;
        refresh();
      }
    })();
    pending = check;
    return check;
  }

  function start() {
    mounted = true;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const scheduleExpiry = () => {
      clearTimeout(expiry);
      const lease = activeHealthProcessingLeaseSnapshot();
      if (lease?.expiresAt !== null && lease?.expiresAt !== undefined) {
        expiry = setTimeout(
          () => {
            retire();
            refresh();
          },
          Math.max(0, lease.expiresAt - Date.now()),
        );
      }
    };
    const off = subscribeActiveHealthProcessingLeaseChanges(() => {
      retire();
      scheduleExpiry();
      void revalidate();
    });
    scheduleExpiry();
    // Child route focus may already have started the same check.
    void revalidate();
    return () => {
      mounted = false;
      off();
      clearTimeout(expiry);
      retire();
    };
  }

  function view(revision: number): ProviderValue {
    const accepted = draft;
    const token = checkToken;
    function isCurrent() {
      if (!mounted || !accepted || draft !== accepted || token !== checkToken || status !== 'ready')
        return false;
      try {
        assertHealthDataWriteLease(accepted.lease);
        return true;
      } catch {
        return false;
      }
    }
    function assertCurrent() {
      if (!isCurrent()) closed();
    }
    function changed() {
      accepted!.revision++;
      refresh();
    }
    function setProfileResult(result: ScoredQuizProfileResult) {
      accepted!.profileResult = result;
    }
    function setQuizAnswers(answers: QuizAnswers) {
      accepted!.quizAnswers = Object.freeze(answers);
    }
    const value: ProviderValue = {
      revision,
      generation: activeHealthProcessingLeaseSnapshot()?.generation ?? null,
      admissionToken: token,
      revalidate,
      get privacyStatus() {
        return isCurrent() ? 'ready' : status === 'checking' ? 'checking' : 'denied';
      },
      get draftGeneration() {
        return isCurrent() ? accepted!.lease.generation : null;
      },
      get goals() {
        return isCurrent() ? accepted!.goals : EMPTY_GOALS;
      },
      get quizAnswers() {
        return isCurrent() ? accepted!.quizAnswers : EMPTY_ANSWERS;
      },
      get profileResult() {
        return isCurrent() ? accepted!.profileResult : null;
      },
      isCurrent,
      toggleGoal(id) {
        if (!isCurrent() || accepted!.save) return;
        const prev = accepted!.goals;
        accepted!.goals = Object.freeze(
          prev.includes(id)
            ? prev.filter((g) => g !== id)
            : prev.length >= MAX_GOALS
              ? [prev[1]!, id]
              : [...prev, id],
        ) as GoalId[];
        accepted!.profileResult = null;
        changed();
      },
      setAnswer(questionId, val) {
        if (!isCurrent() || accepted!.save) return;
        accepted!.profileResult = null;
        setQuizAnswers({
          ...accepted!.quizAnswers,
          [questionId]: Array.isArray(val) ? (Object.freeze([...val]) as string[]) : val,
        });
        changed();
      },
      computeResult() {
        assertCurrent();
        if (accepted!.profileResult) return accepted!.profileResult;
        if (!getQuizCompletionState(accepted!.quizAnswers, ONBOARDING_QUIZ).complete)
          throw new Error('ONBOARDING_QUIZ_INCOMPLETE');
        return scoreQuiz(accepted!.quizAnswers, ONBOARDING_QUIZ);
      },
      persistSkinProfile() {
        if (!isCurrent()) return Promise.reject(new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED));
        if (accepted!.save) return accepted!.save;
        // Capture data AND authority before any await. A later authorized B is never a substitute.
        const leaseAtInvocation = accepted!.lease;
        const goals = [...accepted!.goals];
        const quizAnswers = { ...accepted!.quizAnswers };
        const revision = accepted!.revision;
        function assertSnapshot() {
          assertCurrent();
          assertHealthDataWriteLease(leaseAtInvocation);
          if (accepted!.revision !== revision) closed();
        }
        async function consentCurrent() {
          assertSnapshot();
          const consent = await hasCurrentHealthDataCollectionConsent();
          assertSnapshot();
          if (!consent) {
            retire();
            refresh();
            throw new Error('CURRENT_HEALTH_CONSENT_REQUIRED');
          }
        }
        const save = runHealthDataWriteOperation(leaseAtInvocation.ownerUserId, async (lease) => {
          await consentCurrent();
          lease.assertCurrent();
          if (accepted!.profileResult) return accepted!.profileResult;
          const completion = getQuizCompletionState(quizAnswers, ONBOARDING_QUIZ);
          if (!completion.complete || goals.length === 0)
            throw new Error(
              `Cannot persist incomplete onboarding quiz: ${completion.missingQuestionIds.join(', ')}`,
            );
          const result = scoreQuiz(quizAnswers, ONBOARDING_QUIZ);
          const completedAt = new Date().toISOString();
          await consentCurrent();
          lease.assertCurrent();
          // D-029: the exact v2 receipt is durable locally before the best-effort mirror.
          // The unchanged store captures the identical lease synchronously and
          // reasserts it inside the queued atomic private-KV transaction.
          await setStoredSkinProfileFromExplicitQuiz({ result, goals, completedAt });
          await consentCurrent();
          lease.assertCurrent();
          setProfileResult(result);
          setQuizAnswers({});
          refresh();
          await Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: ['skinProfileBits'] }),
            queryClient.invalidateQueries({ queryKey: ['shelf'] }),
            queryClient.invalidateQueries({ queryKey: ['ramp'] }),
          ]);
          await consentCurrent();
          lease.assertCurrent();
          try {
            const { data: userData } = await getPersistedSupabaseUser();
            await consentCurrent();
            lease.assertCurrent();
            if (userData.user?.id !== lease.ownerUserId)
              throw new Error('SUPABASE_SESSION_OWNER_MISMATCH');
            // Axis scores are stored as the raw signed sums (docs/01 §3 axis ints).
            const { error } = await supabase.from('skin_profiles').insert({
              user_id: lease.ownerUserId,
              oily_dry: result.axisScores.oily_dry,
              sensitive_resistant: result.axisScores.sensitive_resistant,
              pigmented_non: result.axisScores.pigmented_non,
              wrinkled_tight: result.axisScores.wrinkled_tight,
              dspt: result.dspt,
              oily_dry_basis_points: result.axesBasisPoints.oily_dry,
              sensitive_resistant_basis_points: result.axesBasisPoints.sensitive_resistant,
              pigmented_non_basis_points: result.axesBasisPoints.pigmented_non,
              wrinkled_tight_basis_points: result.axesBasisPoints.wrinkled_tight,
              fitzpatrick: result.fitzpatrick,
              monk_tone: result.monkTone,
              sensitivities: result.sensitivities,
              pregnancy_status: result.pregnancyStatus,
              goals,
              completed_at: completedAt,
              version: 2,
              quiz_contract_id: result.provenance.contractId,
              quiz_content_version: result.provenance.contentVersion,
              quiz_scoring_version: result.provenance.scoringVersion,
              quiz_output_schema_version: result.provenance.outputSchemaVersion,
              quiz_content_sha256: result.provenance.contentSha256,
              quiz_scoring_sha256: result.provenance.scoringSha256,
              quiz_contract_sha256: result.provenance.contractSha256,
              quiz_review_status: result.provenance.reviewStatus,
              quiz_pole_tie_rule: result.provenance.poleTieRule,
            });
            lease.assertCurrent();
            if (error) throw error;
          } catch {
            // An unavailable mirror does not undo a durable receipt; stale authority is never success.
            assertSnapshot();
            lease.assertCurrent();
          }
          await consentCurrent();
          lease.assertCurrent();
          return result;
        });
        accepted!.save = save;
        void save
          .finally(() => {
            if (accepted!.save === save) {
              accepted!.save = null;
              refresh();
            }
          })
          .catch(() => {});
        return save;
      },
      reset() {
        if (!isCurrent()) return;
        // An old reset must not clear a later owner's newly admitted answers.
        retire();
        refresh();
        void revalidate();
      },
    };
    return value;
  }
  return {
    start,
    revalidate,
    view,
    snapshot: () => version,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session] = useState(() => createOnboardingSession(queryClient));
  const revision = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  useLayoutEffect(() => session.start(), [session]);
  return (
    <OnboardingContext.Provider value={session.view(revision)}>
      {children}
    </OnboardingContext.Provider>
  );
}

type RouteNavigation = ContextType<typeof NavigationContext>;
function createRouteAdmission() {
  let version = 0;
  const listeners = new Set<() => void>();
  let token = 0;
  let ready = false;
  let lease: HealthDataWriteLease | null = null;
  let cached: {
    revision: number;
    admission: number;
    token: number;
    ready: boolean;
    navigation: RouteNavigation;
    value: OnboardingContextValue;
  } | null = null;
  function refresh() {
    ++version;
    for (const listener of [...listeners]) listener();
  }
  function start(navigation: RouteNavigation, revalidate: ProviderValue['revalidate'] | undefined) {
    if (!navigation || !revalidate) return;
    let active = true;
    function blur() {
      ++token;
      ready = false;
      lease = null;
      if (active) refresh();
    }
    function enter() {
      blur();
      try {
        lease = captureHealthDataWriteLease();
        ready = true;
      } catch {
        lease = null;
        ready = false;
      }
      // The shared provider publishes only the newest exact-window consent read.
      // Do not await a superseded per-consumer promise: mounted sibling routes
      // can request a newer read while this route remains focused.
      void revalidate!(true);
      refresh();
    }
    if (navigation.isFocused()) enter();
    const offFocus = navigation.addListener('focus', enter);
    const offBlur = navigation.addListener('blur', blur);
    return () => {
      active = false;
      offFocus();
      offBlur();
      blur();
    };
  }
  function view(
    ctx: ProviderValue,
    navigation: RouteNavigation,
    revision: number,
  ): OnboardingContextValue {
    if (
      cached?.revision === revision &&
      cached.admission === ctx.admissionToken &&
      cached.token === token &&
      cached.ready === ready &&
      cached.navigation === navigation
    )
      return cached.value;
    const acceptedToken = token;
    function isCurrent() {
      if (!ctx.isCurrent()) return false;
      if (!navigation) return true;
      if (acceptedToken !== token || !ready || !navigation.isFocused() || !lease) return false;
      try {
        assertHealthDataWriteLease(lease);
        return true;
      } catch {
        return false;
      }
    }
    // Stable functions for one exact window; private getters never cache plaintext.
    const value: OnboardingContextValue = {
      get goals() {
        return isCurrent() ? ctx.goals : EMPTY_GOALS;
      },
      get quizAnswers() {
        return isCurrent() ? ctx.quizAnswers : EMPTY_ANSWERS;
      },
      get profileResult() {
        return isCurrent() ? ctx.profileResult : null;
      },
      get privacyStatus() {
        return isCurrent() ? 'ready' : ctx.privacyStatus === 'denied' ? 'denied' : 'checking';
      },
      get draftGeneration() {
        return isCurrent() ? ctx.draftGeneration : null;
      },
      isCurrent,
      toggleGoal(id) {
        if (isCurrent()) ctx.toggleGoal(id);
      },
      setAnswer(id, val) {
        if (isCurrent()) ctx.setAnswer(id, val);
      },
      computeResult() {
        if (!isCurrent()) closed();
        return ctx.computeResult();
      },
      persistSkinProfile() {
        return isCurrent()
          ? ctx.persistSkinProfile()
          : Promise.reject(new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED));
      },
      reset() {
        if (isCurrent()) ctx.reset();
      },
    };
    cached = { revision, admission: ctx.admissionToken, token, ready, navigation, value };
    return value;
  }
  return {
    start,
    view,
    snapshot: () => version,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Every consumer, including mounted routes outside this repair, receives a focus-fenced view. */
export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  const navigation = useContext(NavigationContext);
  const [route] = useState(createRouteAdmission);
  const revision = useSyncExternalStore(route.subscribe, route.snapshot, route.snapshot);
  const revalidate = ctx?.revalidate;
  const generation = ctx?.generation;
  useLayoutEffect(
    () => route.start(navigation, revalidate),
    [route, navigation, revalidate, generation],
  );
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return route.view(ctx, navigation, revision);
}
