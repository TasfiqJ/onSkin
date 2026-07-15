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
    expect(source).toContain(
      "type PrivacyFeedbackKey = 'marketing' | 'data_sharing' | 'app_lock';",
    );
    expect(source).toContain(
      "type PrivacyFeedbackPlacement = 'commerce' | 'privacy' | 'security';",
    );
    expect(source).toContain("const PRIVACY_CHOICE_SAVE_FAILED_TITLE = 'Choice not saved';");
    expect(source).toContain('const [privacyFeedback, setPrivacyFeedback] = useState<{');
    expect(source).toContain('const [savingAppLock, setSavingAppLock] = useState(false);');
    expect(source).toContain('function renderPrivacyFeedback(');
    expect(source).toContain('async function setAppLockChoice(enabled: boolean)');
    expect(source).toContain("renderPrivacyFeedback('app_lock', 'security')");
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('{PRIVACY_CHOICE_SAVE_FAILED_TITLE}');
    expect(source).toContain(
      'setPrivacyFeedback({ key: type, placement, message: privacyChoiceUserMessage() })',
    );
    expect(source).toContain("placement: 'security'");
    expect(source).toContain("onChange={(v) => void setConsent('data_sharing', v, 'commerce')}");
    expect(source).toContain("onChange={(v) => void setConsent('marketing', v, 'privacy')}");
    expect(source).toContain("onChange={(v) => void setConsent('data_sharing', v, 'privacy')}");
    expect(source).not.toContain("Alert.alert('Choice not saved'");
    expect(source).not.toContain("Alert.alert('Encrypted cloud backup'");
    expect(source).toContain(
      "disabled={savingPrivacy === 'marketing' || !marketingConsentControl.canChange}",
    );
    expect(source).toContain("savingPrivacy === 'data_sharing' || !commerceConsentControl.canChange");
    expect(source).toContain('latestConsentsQueryOptions(ownerScope)');
    expect(source).toContain('commerceConsentQueryOptions(ownerScope)');
    expect(source).toContain('const marketingConsentControl = consentManagementState(');
    expect(source).toContain('const commerceConsentControl = consentManagementState(');
    expect(source).toContain('value={marketingConsentControl.value}');
    expect(source).toContain('value={commerceConsentControl.value}');
    expect(source).toContain('!marketingConsentControl.canChange');
    expect(source).toContain('!commerceConsentControl.canChange');
    expect(source).toContain('onRetry={() => void consents.refetch()}');
    expect(source).toContain('onRetry={() => void commerceConsent.refetch()}');
    expect(source).toContain("if (type !== 'data_sharing') throw error;");
    expect(source).not.toContain("if (type === 'data_sharing' && granted)");
    expect(source).not.toContain('await setCommerceConsentLocal(false).catch(() => undefined);');
    expect(source).toContain('label="Progress photo storage"');
    expect(source).toContain('Cloud backup is not available in this build.');
    expect(source).toContain('Device only');
    expect(source).not.toContain('setCloudBackupEnabled');
    expect(source).not.toContain('getCloudBackupEnabled');
    expect(source).not.toContain("track('cloud_backup_opted_in')");
    expect(source).not.toContain('accessibilityLabel="Encrypted cloud backup"');
  });
});
