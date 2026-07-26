import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applySettingsPrivacyChoice } from './applyPrivacyChoice';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const deps = {
  save: vi.fn<() => Promise<void>>(),
  onSaved: vi.fn<() => void>(),
  onFailure: vi.fn<() => void>(),
  onSettled: vi.fn<() => Promise<unknown>>(),
};

describe('settings privacy choice application', () => {
  beforeEach(() => {
    deps.save.mockReset();
    deps.onSaved.mockReset();
    deps.onFailure.mockReset();
    deps.onSettled.mockReset();
    deps.save.mockResolvedValue(undefined);
    deps.onSettled.mockResolvedValue(undefined);
  });

  it('persists the choice before applying visible state or side effects', async () => {
    await expect(applySettingsPrivacyChoice(deps)).resolves.toBe(true);

    expect(deps.save).toHaveBeenCalledTimes(1);
    expect(deps.onSaved).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
    expect(deps.onSettled).toHaveBeenCalledTimes(1);
  });

  it('fails closed when privacy choice persistence rejects', async () => {
    deps.save.mockRejectedValueOnce(new Error('private storage unavailable'));

    await expect(applySettingsPrivacyChoice(deps)).resolves.toBe(false);

    expect(deps.onFailure).toHaveBeenCalledTimes(1);
    expect(deps.onSaved).not.toHaveBeenCalled();
    expect(deps.onSettled).toHaveBeenCalledTimes(1);
  });

  it('keeps active privacy toggles persistence-first and unavailable backup non-interactive', () => {
    const source = readSource('app/(tabs)/you.tsx');

    expect(source).toContain('applySettingsPrivacyChoice');
    expect(source).toContain("type PrivacyFeedbackKey = 'marketing' | 'data_sharing';");
    expect(source).toContain("type PrivacyFeedbackPlacement = 'commerce' | 'privacy';");
    expect(source).toContain("const PRIVACY_CHOICE_SAVE_FAILED_TITLE = 'Choice not saved';");
    expect(source).toContain(
      'const [privacyFeedback, setPrivacyFeedback] = useState<PrivacyFeedback',
    );
    expect(source).toContain('const [savingAppLock, setSavingAppLock] = useState(false);');
    expect(source).toContain('function ConsentFeedbackText(');
    expect(source).toContain('const setAppLockChoice = useCallback(');
    expect(source).toContain('const [appLockFeedback, setAppLockFeedback]');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('{PRIVACY_CHOICE_SAVE_FAILED_TITLE}');
    expect(source).toContain('ownerGeneration: ownerScope.generation');
    expect(source).toContain('granted,');
    expect(source).toContain(
      "onChange={(value) => void setConsent('data_sharing', value, 'commerce')}",
    );
    expect(source).toContain(
      "onChange={(value) => void setConsent('marketing', value, 'privacy')}",
    );
    expect(source).toContain(
      "onChange={(value) => void setConsent('data_sharing', value, 'privacy')}",
    );
    expect(source).not.toContain("Alert.alert('Choice not saved'");
    expect(source).not.toContain("Alert.alert('Encrypted cloud backup'");
    expect(source).toContain(
      'disabled={savingPrivacy !== null || !marketingConsentControl.canChange}',
    );
    expect(
      source.match(/disabled=\{savingPrivacy !== null \|\| !commerceConsentControl\.canChange\}/g),
    ).toHaveLength(2);
    expect(source).toContain('latestConsentsQueryOptions(ownerScope)');
    expect(source).toContain('commerceConsentQueryOptions(ownerScope)');
    expect(source).toContain('const marketingConsentControl = consentManagementState(');
    expect(source).toContain('const commerceConsentControl = consentManagementState(');
    expect(source).not.toContain('dataSharingConsentManagementState');
    expect(source).toContain('value={marketingConsentControl.value}');
    expect(source).toContain('value={commerceConsentControl.value}');
    expect(source).toContain('!marketingConsentControl.canChange');
    expect(source).toContain('!commerceConsentControl.canChange');
    expect(source).toContain('onRetry={retryMarketingConsent}');
    expect(source).toContain('onRetry={retryCommerceConsent}');
    expect(source).toContain('persistSettingsPrivacyConsentChoice(ownerScope, {');
    expect(source).toContain('onLocalDataSharingSaved: (localGranted) => {');
    expect(source).toContain('queryKeys.commerceConsentWithdrawalPending(ownerScope)');
    expect(source).toContain('commerceConsentWithdrawalPending.data === true');
    expect(source).toContain('onDataSharingWithdrawalCompleted: () => {');
    expect(source).toContain('retryableSettingsPrivacyChoice(');
    expect(source).toContain('void setConsent(retry.type, retry.granted, retry.placement);');
    expect(source).toContain('label="Try again"');
    expect(source).toContain('retryDisabled={savingPrivacy !== null}');
    expect(source).toContain(
      "<YouConsentCoordinator pendingFeedbackPlacement={privacyDirectEntry ? 'privacy' : 'commerce'}>",
    );
    expect(source).not.toContain('recordConsent({');
    expect(source).not.toContain('setCommerceConsentLocal(');
    expect(source).toContain('label="Progress photo storage"');
    expect(source).toContain('Cloud backup is not available in this build.');
    expect(source).toContain('Device only');

    const guard = source.indexOf('if (savingPrivacyRef.current) return;');
    const claim = source.indexOf('savingPrivacyRef.current = true;', guard);
    const count = source.indexOf('recordYouConsentStart();', claim);
    const firstAwait = source.indexOf('await applySettingsPrivacyChoice({', count);
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(claim).toBeGreaterThan(guard);
    expect(count).toBeGreaterThan(claim);
    expect(firstAwait).toBeGreaterThan(count);

    expect(source).not.toContain('setCloudBackupEnabled');
    expect(source).not.toContain('getCloudBackupEnabled');
    expect(source).not.toContain("track('cloud_backup_opted_in')");
    expect(source).not.toContain('accessibilityLabel="Encrypted cloud backup"');
  });
});
