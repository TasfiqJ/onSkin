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
  grant: vi.fn<() => Promise<'saved'>>(),
  requestPermission: vi.fn<() => Promise<unknown>>(),
  onSaved: vi.fn<(result: 'saved') => boolean>(),
  onFailure: vi.fn<(error: unknown) => void>(),
};

describe('photo capture consent application', () => {
  beforeEach(() => {
    deps.grant.mockReset();
    deps.requestPermission.mockReset();
    deps.onSaved.mockReset();
    deps.onFailure.mockReset();
    deps.grant.mockResolvedValue('saved');
    deps.requestPermission.mockResolvedValue(undefined);
    deps.onSaved.mockReturnValue(true);
  });

  it('saves consent before marking the gate as passed or asking for camera permission', async () => {
    await expect(applyPhotoCaptureConsent(deps)).resolves.toBe(true);

    expect(deps.grant).toHaveBeenCalledTimes(1);
    expect(deps.onSaved).toHaveBeenCalledWith('saved');
    expect(deps.requestPermission).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it('fails closed when consent cannot be saved', async () => {
    const error = new Error('private storage unavailable');
    deps.grant.mockRejectedValueOnce(error);

    await expect(applyPhotoCaptureConsent(deps)).resolves.toBe(false);

    expect(deps.onFailure).toHaveBeenCalledWith(error);
    expect(deps.onSaved).not.toHaveBeenCalled();
    expect(deps.requestPermission).not.toHaveBeenCalled();
  });

  it('does not undo saved consent when the OS permission request fails', async () => {
    deps.requestPermission.mockRejectedValueOnce(new Error('permission prompt unavailable'));

    await expect(applyPhotoCaptureConsent(deps)).resolves.toBe(true);

    expect(deps.onSaved).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it('contains a synchronous OS permission request failure', async () => {
    deps.requestPermission.mockImplementationOnce(() => {
      throw new Error('permission prompt unavailable');
    });

    await expect(applyPhotoCaptureConsent(deps)).resolves.toBe(true);

    expect(deps.requestPermission).toHaveBeenCalledTimes(1);
    expect(deps.onSaved).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it('does not request permission after the current route can no longer publish', async () => {
    deps.onSaved.mockReturnValueOnce(false);

    await expect(applyPhotoCaptureConsent(deps)).resolves.toBe(true);

    expect(deps.onSaved).toHaveBeenCalledWith('saved');
    expect(deps.requestPermission).not.toHaveBeenCalled();
    expect(deps.onFailure).not.toHaveBeenCalled();
  });

  it('launches permission synchronously before a queued owner invalidation can run', async () => {
    let ownerInvalidated = false;
    deps.onSaved.mockImplementationOnce(() => {
      queueMicrotask(() => {
        ownerInvalidated = true;
      });
      return true;
    });
    deps.requestPermission.mockImplementationOnce(async () => {
      expect(ownerInvalidated).toBe(false);
    });

    await expect(applyPhotoCaptureConsent(deps)).resolves.toBe(true);
    await Promise.resolve();

    expect(ownerInvalidated).toBe(true);
    expect(deps.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('deduplicates permission requests across concurrent consent helpers', async () => {
    let finishPermission!: () => void;
    deps.requestPermission.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPermission = resolve;
        }),
    );

    await expect(
      Promise.all([applyPhotoCaptureConsent(deps), applyPhotoCaptureConsent(deps)]),
    ).resolves.toEqual([true, true]);

    expect(deps.grant).toHaveBeenCalledTimes(2);
    expect(deps.onSaved).toHaveBeenCalledTimes(2);
    expect(deps.requestPermission).toHaveBeenCalledTimes(1);

    finishPermission();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('keeps the capture route on the failure-handled consent helper', () => {
    const source = readSource('app/progress/capture.tsx');

    expect(PHOTO_COPY.capture.consentFailedTitle).toBe('Photo choice not saved');
    expect(source).toContain('applyPhotoCaptureConsent');
    expect(source).toContain('EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE');
    expect(source).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(source).toContain('simulatedPhotoConsentFailureUsed.current = true');
    expect(source).toContain("new Error('E2E_PHOTO_CONSENT_FAILURE')");
    expect(source).toContain(
      'const [consentSaveFailure, setConsentSaveFailure] = useState<ConsentSaveFailure>(null)',
    );
    expect(source).toContain('saveFailure={consentSaveFailure}');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('const shortPhone = height < 520');
    expect(source).toContain(
      'const showPrepReminder = !(shortPhone || (compact && (saveFailed || reconsentRequired)))',
    );
    expect(source).toContain('{showPrepReminder ? (');
    expect(source).toContain('PHOTO_COPY.capture.consentFailedTitle');
    expect(source).toContain('PHOTO_COPY.capture.consentFailedBody');
    expect(source).toContain('consentGrantInFlightRef.current = true');
    expect(source).toContain('PhotoCaptureConsentWriteUncertainError');
    expect(source).toContain("? 'uncertain' : 'failed'");
    expect(source).toContain('setConsentSaveFailure(null)');
    expect(source).toContain('disabled={granting}');
    expect(source).toContain('Saving choice');
    expect(source).not.toContain('Alert.alert(PHOTO_COPY.capture.consentFailedTitle');
    expect(source).not.toContain('void grantPhotoCaptureConsent();');
    expect(source).not.toContain('setConsented(true);\n            if (!permission?.granted)');
    expect(source.indexOf('simulatedPhotoConsentFailureUsed.current = true')).toBeLessThan(
      source.indexOf("new Error('E2E_PHOTO_CONSENT_FAILURE')"),
    );
  });

  it('does not let a never-settling native permission request pin consent completion', async () => {
    deps.requestPermission.mockReturnValueOnce(new Promise<never>(() => undefined));

    await expect(applyPhotoCaptureConsent(deps)).resolves.toBe(true);

    expect(deps.requestPermission).toHaveBeenCalledTimes(1);
    expect(deps.onSaved).toHaveBeenCalledTimes(1);
    expect(deps.onFailure).not.toHaveBeenCalled();
  });
});
