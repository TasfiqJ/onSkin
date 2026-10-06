import { useEffect } from 'react';
import { AppState } from 'react-native';
import { onlineManager, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth/AuthProvider';
import {
  captureHealthDataWriteLease,
  assertHealthDataWriteLease,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { subscribeActiveHealthProcessingLeaseChanges } from '@/lib/consent/healthProcessingEpoch';

import { getPhotoDeleteStatus, retryPhotoDeletes } from './store';
import { subscribePhotoDeleteChanges } from './photoDeleteJournal';

/** Narrow replacement for the photo lane lost during Lean integration. Other
 * queues and global account/health admission are deliberately untouched. */
export function PhotoDeleteReplay() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const owner = user?.id ?? null;
  useEffect(() => {
    let disposed = false;
    let active = AppState.currentState === 'active';
    let generation = 0;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const current = (lease: HealthDataWriteLease, run: number) => {
      if (disposed || !active || generation !== run) return false;
      try {
        assertHealthDataWriteLease(lease);
        return true;
      } catch {
        return false;
      }
    };
    const schedule = (lease: HealthDataWriteLease, run: number) => {
      if (!current(lease, run) || !onlineManager.isOnline()) return;
      clearTimer();
      const delay = Math.min(1000 * 2 ** Math.min(attempt++, 6), 60_000);
      timer = setTimeout(() => {
        timer = null;
        if (current(lease, run)) replay();
      }, delay);
    };
    const replay = () => {
      const run = ++generation;
      clearTimer();
      if (disposed || !active) return;
      let lease: HealthDataWriteLease;
      try {
        lease = captureHealthDataWriteLease();
      } catch {
        return;
      }
      void retryPhotoDeletes(onlineManager.isOnline() ? owner : null, false)
        .then(async () => {
          if (!current(lease, run)) return;
          const status = await getPhotoDeleteStatus();
          if (!current(lease, run)) return;
          if (
            status.localPending > 0 ||
            (status.remotePending > 0 && !status.needsAttention && owner !== null)
          )
            schedule(lease, run);
          else attempt = 0;
        })
        .catch(() => {
          schedule(lease, run);
        });
    };
    const unsubscribeJournal = subscribePhotoDeleteChanges(() => {
      // A journal update is emitted only after the original lease is checked.
      // Close cached publication immediately, including offscreen observers.
      void qc.invalidateQueries({ queryKey: ['photos'] });
      if (active) replay();
    });
    const unsubscribeHealth = subscribeActiveHealthProcessingLeaseChanges(() => {
      generation += 1;
      attempt = 0;
      clearTimer();
      replay();
    });
    const unsubscribeOnline = onlineManager.subscribe(() => {
      attempt = 0;
      replay();
    });
    const appState = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      generation += 1;
      clearTimer();
      if (active) {
        attempt = 0;
        replay();
      }
    });
    replay();
    return () => {
      disposed = true;
      generation += 1;
      clearTimer();
      unsubscribeJournal();
      unsubscribeHealth();
      unsubscribeOnline();
      appState.remove();
    };
  }, [owner, qc]);
  return null;
}
