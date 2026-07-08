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

  it('keeps You-tab privacy toggles on the persistence-first helper with local-first commerce', () => {
    const source = readSource('app/(tabs)/you.tsx');
    const saveCloudIndex = source.indexOf('await setCloudBackupEnabled(enabled);');
    const cloudQueryIndex = source.indexOf("qc.setQueryData(['photo_cloud_backup'], enabled);");
    const cloudAnalyticsIndex = source.indexOf("track('cloud_backup_opted_in');");

    expect(source).toContain('applySettingsPrivacyChoice');
    expect(source).toContain(
      "type PrivacyFeedbackKey = 'marketing' | 'data_sharing' | 'photo_cloud_backup' | 'app_lock';",
    );
    expect(source).toContain("type PrivacyFeedbackPlacement = 'commerce' | 'privacy' | 'security';");
    expect(source).toContain("const PRIVACY_CHOICE_SAVE_FAILED_TITLE = 'Choice not saved';");
    expect(source).toContain('const [privacyFeedback, setPrivacyFeedback] = useState<{');
    expect(source).toContain('const [savingAppLock, setSavingAppLock] = useState(false);');
    expect(source).toContain('function renderPrivacyFeedback(');
    expect(source).toContain('async function setAppLockChoice(enabled: boolean)');
    expect(source).toContain("renderPrivacyFeedback('app_lock', 'security')");
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('{PRIVACY_CHOICE_SAVE_FAILED_TITLE}');
    expect(source).toContain('setPrivacyFeedback({ key: type, placement, message: privacyChoiceUserMessage() })');
    expect(source).toContain("placement: 'security'");
    expect(source).toContain("onChange={(v) => void setConsent('data_sharing', v, 'commerce')}");
    expect(source).toContain("onChange={(v) => void setConsent('marketing', v, 'privacy')}");
    expect(source).toContain("onChange={(v) => void setConsent('data_sharing', v, 'privacy')}");
    expect(source).not.toContain("Alert.alert('Choice not saved'");
    expect(source).toContain("disabled={savingPrivacy === 'marketing'}");
    expect(source).toContain("disabled={savingPrivacy === 'data_sharing'}");
    expect(source).toContain("disabled={savingPrivacy === 'photo_cloud_backup'}");
    expect(source).toContain("if (type !== 'data_sharing') throw error;");
    expect(source).not.toContain("if (type === 'data_sharing' && granted)");
    expect(source).not.toContain('await setCommerceConsentLocal(false).catch(() => undefined);');
    expect(saveCloudIndex).toBeGreaterThanOrEqual(0);
    expect(cloudQueryIndex).toBeGreaterThan(saveCloudIndex);
    expect(cloudAnalyticsIndex).toBeGreaterThan(saveCloudIndex);
    expect(source).not.toContain(
      "qc.setQueryData(['photo_cloud_backup'], enabled);\n    if (enabled) {",
    );
  });
});
