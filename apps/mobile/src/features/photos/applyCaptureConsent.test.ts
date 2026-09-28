import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyPhotoCaptureConsent } from './applyCaptureConsent';
import { PHOTO_COPY } from './copy';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const deps = {
  grant: vi.fn<() => Promise<void>>(),
  requestPermission: vi.fn<() => Promise<unknown>>(),
  onSaved: vi.fn<() => boolean>(),
  onFailure: vi.fn<() => void>(),
};

describe('photo capture consent application', () => {
  beforeEach(() => {
    deps.grant.mockReset();
    deps.requestPermission.mockReset();
    deps.onSaved.mockReset();
    deps.onFailure.mockReset();
    deps.grant.mockResolvedValue(undefined);
    deps.requestPermission.mockResolvedValue(undefined);
    deps.onSaved.mockReturnValue(true);
  });

  it('saves consent before marking the gate as passed or asking for camera permission', async () => {
    await expect(applyPhotoCaptureConsent(deps)).resolves.toBe(true);

    expect(deps.grant).toHaveBeenCalledTimes(1);
    expect(deps.onSaved).toHaveBeenCalledTimes(1);
    expect(deps.requestPermission).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it('fails closed when consent cannot be saved', async () => {
    deps.grant.mockRejectedValueOnce(new Error('private storage unavailable'));

    await expect(applyPhotoCaptureConsent(deps)).resolves.toBe(false);

    expect(deps.onFailure).toHaveBeenCalledTimes(1);
    expect(deps.onSaved).not.toHaveBeenCalled();
    expect(deps.requestPermission).not.toHaveBeenCalled();
  });

  it('does not undo saved consent when the OS permission request fails', async () => {
    deps.requestPermission.mockRejectedValueOnce(new Error('permission prompt unavailable'));

    await expect(applyPhotoCaptureConsent(deps)).resolves.toBe(true);

    expect(deps.onSaved).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it('keeps the capture route on the failure-handled consent helper', () => {
    const source = readSource('app/progress/capture.tsx');

    expect(PHOTO_COPY.capture.consentFailedTitle).toBe('Photo choice not saved');
    expect(source).toContain('applyPhotoCaptureConsent');
    expect(source).toContain('EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE');
    expect(source).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(source).toContain('simulatedPhotoConsentFailureUsed.current = true');
    expect(source).toContain("new Error('E2E_PHOTO_CONSENT_FAILURE')");
    expect(source).toContain('const [consentSaveFailed, setConsentSaveFailed] = useState(false)');
    expect(source).toContain('saveFailed={consentSaveFailed}');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('const shortPhone = height < 520');
    expect(source).toContain('const showPrepReminder = !(shortPhone || (compact && saveFailed))');
    expect(source).toContain('{showPrepReminder ? (');
    expect(source).toContain('PHOTO_COPY.capture.consentFailedTitle');
    expect(source).toContain('PHOTO_COPY.capture.consentFailedBody');
    expect(source).toContain('setConsentSaveFailed(true)');
    expect(source).toContain('setConsentSaveFailed(false)');
    expect(source).toContain('disabled={granting}');
    expect(source).toContain('Saving choice');
    expect(source).not.toContain('Alert.alert(PHOTO_COPY.capture.consentFailedTitle');
    expect(source).not.toContain('void grantPhotoCaptureConsent();');
    expect(source).not.toContain('setConsented(true);\n            if (!permission?.granted)');
    expect(source.indexOf('simulatedPhotoConsentFailureUsed.current = true')).toBeLessThan(
      source.indexOf("new Error('E2E_PHOTO_CONSENT_FAILURE')"),
    );
  });
});
