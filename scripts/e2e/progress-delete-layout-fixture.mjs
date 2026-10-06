// Browser-runner-only fixture. Never imported by the app or an Expo route.
// All age/health/Pro/lock/source gates remain real. Only unavailable native-web
// filesystem/SecureStore I/O and an explicit status-read outage are controlled here.
// Synthetic photo metadata and journals are written by real private KV under
// the authority obtained through the existing visible age/consent bootstrap.
export async function installNativePhotoLayoutFixture({ portsOnly = false } = {}) {
  if (location.hostname !== 'localhost' || !globalThis.__DEV__)
    throw new Error('Local development fixture only');
  const module = (suffix) => {
    const found = Array.from(__r.getModules().entries()).filter(([, m]) =>
      m.verboseName?.replaceAll('\\', '/').endsWith(suffix),
    );
    if (found.length !== 1) throw new Error('Module not unique: ' + suffix);
    return __r(found[0][0]);
  };
  const environment = module('src/lib/env.ts');
  if (environment.isSupabaseConfigured || environment.env.appEnvironment !== 'development')
    throw new Error('Refusing configured or non-development app');
  // Native filesystem is absent on Expo web. Simulate only these local fixture
  // URIs; retain the real photo store, journal, private KV, and all authority gates.
  const fs = module('expo-file-system/src/legacy/ExponentFileSystem.web.ts').default;
  const media = new Map();
  const io = {
    failCleanup: false,
    deletes: 0,
    statusReads: 0,
    manualRetries: 0,
    statusUnavailable: false,
  };
  fs.getInfoAsync = async (uri) => ({
    exists: uri === 'photos/v1/' || media.has(uri),
    isDirectory: uri === 'photos/v1/',
    uri,
    size: 0,
  });
  fs.readDirectoryAsync = async (uri) => {
    if (uri === 'photos/v1/') return [...media.keys()].map((u) => u.slice(uri.length));
    return [];
  };
  fs.deleteAsync = async (uri) => {
    io.deletes++;
    if (io.failCleanup && uri.includes('c08b2-layout'))
      throw new Error('C08B2_LAYOUT_CONTROLLED_CLEANUP_FAILURE');
    media.delete(uri);
  };
  // SecureStore has no native implementation on web. Keep its synthetic key
  // port independent from ordinary private KV, exactly as on native devices.
  const secure = module('src/lib/storage/privateSecureStore.ts');
  const secureKeys = new Map();
  secure.getPrivateSecureStoreItemAsync = async (key) => secureKeys.get(key) ?? null;
  secure.setPrivateSecureStoreItemAsync = async (key, value) => {
    secureKeys.set(key, value);
  };
  secure.deletePrivateSecureStoreItemAsync = async (key) => {
    secureKeys.delete(key);
  };
  // Native ports must exist before the real first-consent cleanup can run.
  // This phase does not seed private data or open any authority. The full
  // fixture below still requires the actual visible age/consent bootstrap.
  if (portsOnly) return { nativePortsInstalled: true, authorityChanged: false };
  const remoteCleanup = module('src/features/photos/photoDeleteRemoteCleanup.ts');
  const health = module('src/lib/consent/healthProcessingEpoch.ts');
  const admission = module('src/lib/consent/healthDataWriteAdmission.ts');
  const kv = module('src/lib/storage/privateKV.ts');
  const store = module('src/features/photos/store.ts');
  const journal = module('src/features/photos/photoDeleteJournal.ts');
  const actualStatus = store.getPhotoDeleteStatus;
  store.getPhotoDeleteStatus = (...args) => {
    io.statusReads++;
    return io.statusUnavailable
      ? Promise.reject(new Error('C08B2_LAYOUT_STATUS_READ_UNAVAILABLE'))
      : actualStatus(...args);
  };
  const actualRetry = store.retryPhotoDeletes;
  store.retryPhotoDeletes = (...args) => {
    if (args[1] !== false) io.manualRetries++;
    return actualRetry(...args);
  };
  const active = health.activeHealthProcessingLeaseSnapshot();
  if (!active || active.ownerUserId !== 'local-device-unclaimed')
    throw new Error('Complete authorized age/consent bootstrap first');
  const keyModule = module('src/lib/query/queryClient.ts');
  globalThis.__C08B2_LAYOUT_FIXTURE__ = {
    io,
    seed: async (mode, populated = false) => {
      await keyModule.queryClient.cancelQueries({ queryKey: ['photos'] });
      io.failCleanup = mode === 'local';
      io.statusUnavailable = mode === 'unavailable';
      media.clear();
      const photoIds = [
        'aaaaaaaa-aaaa-4aaa-8aaa-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-222222222222',
      ];
      const rows = populated
        ? photoIds.map((id, i) => ({
            id,
            series: 'front',
            takenLocalDate: i ? '2026-09-30' : '2026-09-01',
            takenAt: i ? '2026-09-30T12:00:00Z' : '2026-09-01T12:00:00Z',
            isReference: i === 0,
            referencePhotoId: i ? photoIds[0] : null,
            notes: null,
            localUri: null,
            encryptedLocalUri: null,
            thumbnailLocalUri: null,
            captureSessionId: null,
            localOnly: true,
            isEncrypted: false,
          }))
        : [];
      await admission.runCurrentHealthDataOperation(async (lease) => {
        await journal.writePhotoDeleteJournal([], lease);
        // Each scenario owns fresh synthetic data. Retire only this fixture
        // owner's prior obligations through the actual lease-bound API.
        for (const operation of await remoteCleanup.readPhotoDeleteRemoteObligations(lease)) {
          await remoteCleanup.settlePhotoDeleteRemoteObligation(
            operation.operationId,
            'remove',
            lease,
          );
        }
        lease.assertCurrent();
        await kv.setPrivateItem('layerwell.photos.v1', JSON.stringify(rows));
        lease.assertCurrent();
        if (mode === 'local' || mode === 'remote') {
          const files =
            mode === 'local'
              ? [
                  'photos/v1/c08b2-layout-original.layerwellphoto',
                  'photos/v1/c08b2-layout-thumbnail.layerwellphoto',
                ]
              : [];
          for (const file of files) media.set(file, 'fixture-encrypted-envelope-placeholder');
          await journal.writePhotoDeleteJournal(
            [
              {
                operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                photoId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                ownerUserId: lease.ownerUserId,
                epoch: lease.epoch,
                phase: 'metadata_committed',
                remotePending: mode === 'remote',
                needsAttention: false,
                files,
              },
            ],
            lease,
          );
        }
      });
      await keyModule.queryClient.invalidateQueries({ queryKey: ['photos'] });
      return { status: await actualStatus(), count: (await store.loadPhotos()).length };
    },
  };
  return { installed: true, authority: { owner: active.ownerUserId, epoch: active.epoch } };
}

export function measureProgressLayout() {
  const box = (r) => ({
    x: r.left,
    y: r.top,
    width: r.width,
    height: r.height,
    right: r.right,
    bottom: r.bottom,
  });
  const dock = document.querySelector('[data-testid="floating-dock"]');
  const dockBox = dock?.getBoundingClientRect();
  const nodes = Array.from(
    document.querySelectorAll('[role="button"],button,[role="link"],a,[role="tab"]'),
  ).filter((n) => !n.closest('[aria-hidden="true"],[inert]'));
  const controls = nodes
    .map((n) => {
      const r = n.getBoundingClientRect();
      let c = {
        left: Math.max(0, r.left),
        top: Math.max(0, r.top),
        right: Math.min(innerWidth, r.right),
        bottom: Math.min(innerHeight, r.bottom),
      };
      let hidden = false;
      for (let a = n; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0)
          hidden = true;
        if (a === n) continue;
        const b = a.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(s.overflowX)) {
          c.left = Math.max(c.left, b.left);
          c.right = Math.min(c.right, b.right);
        }
        if (/auto|scroll|hidden|clip/.test(s.overflowY)) {
          c.top = Math.max(c.top, b.top);
          c.bottom = Math.min(c.bottom, b.bottom);
        }
      }
      const inDock = Boolean(dock?.contains(n));
      if (!inDock && dockBox) c.bottom = Math.min(c.bottom, dockBox.top);
      const visible =
        !hidden && r.width > 0 && r.height > 0 && c.right > c.left && c.bottom > c.top;
      const full =
        visible &&
        r.left >= c.left - 0.5 &&
        r.top >= c.top - 0.5 &&
        r.right <= c.right + 0.5 &&
        r.bottom <= c.bottom + 0.5;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const corners = [
        [2, 2],
        [r.width - 2, 2],
        [2, r.height - 2],
        [r.width - 2, r.height - 2],
      ].map(([x, y]) => {
        const h = document.elementFromPoint(r.left + x, r.top + y);
        return Boolean(h && (h === n || n.contains(h)));
      });
      return {
        label: n.getAttribute('aria-label') || n.textContent?.trim(),
        text: n.textContent?.trim(),
        role: n.getAttribute('role'),
        rect: box(r),
        visible,
        fullyVisible: full,
        centerHittable: Boolean(hit && (hit === n || n.contains(hit))),
        cornerHits: corners,
        aboveDock: inDock || Boolean(dockBox && r.bottom <= dockBox.top),
        touchTarget: r.width >= 44 && r.height >= 44,
        inDock,
      };
    })
    .filter((c) => c.rect.width > 0 && c.rect.height > 0);
  return {
    pathname: location.pathname,
    viewport: { width: innerWidth, height: innerHeight },
    dock: dockBox ? box(dockBox) : null,
    controls,
    partialControls: controls.filter((c) => c.visible && !c.fullyVisible),
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    body: document.body.innerText,
    alerts: Array.from(document.querySelectorAll('[role="alert"]'))
      .filter((node) => !node.closest('[aria-hidden="true"],[inert]'))
      .map((node) => ({
        live: node.getAttribute('aria-live'),
        busy: node.getAttribute('aria-busy'),
        text: node.textContent,
      })),
    progressIndicators: document.querySelectorAll('[role="progressbar"]').length,
  };
}
