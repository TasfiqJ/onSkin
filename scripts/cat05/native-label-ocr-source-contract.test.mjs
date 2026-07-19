import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const moduleRoot = resolve(root, 'apps/mobile/modules/native-label-ocr');
const moduleConfigPath = resolve(moduleRoot, 'expo-module.config.json');
const podspecPath = resolve(moduleRoot, 'ios/NativeLabelOcr.podspec');
const swiftPath = resolve(moduleRoot, 'ios/NativeLabelOcrModule.swift');
const typesPath = resolve(moduleRoot, 'src/NativeLabelOcr.types.ts');
const bridgePath = resolve(moduleRoot, 'src/NativeLabelOcrModule.ts');
const startupCleanupPath = resolve(
  root,
  'apps/mobile/src/features/native/camera/labelPhotoStartup.ts',
);
const labelPhotoLifecyclePath = resolve(
  root,
  'apps/mobile/src/features/native/camera/labelPhotoLifecycle.ts',
);
const labelCaptureRoutePath = resolve(root, 'apps/mobile/src/app/shelf/ocr.tsx');
const progressCaptureRoutePath = resolve(root, 'apps/mobile/src/app/progress/capture.tsx');
const progressReviewRoutePath = resolve(root, 'apps/mobile/src/app/progress/review.tsx');
const progressCapturePrivacyPath = resolve(
  root,
  'apps/mobile/src/features/photos/progressCapturePrivacy.ts',
);
const progressCaptureRouteBoundaryPath = resolve(
  root,
  'apps/mobile/src/features/photos/progressCaptureRouteBoundary.ts',
);
const progressCaptureRouteBoundaryTestPath = resolve(
  root,
  'apps/mobile/src/features/photos/progressCaptureRouteBoundary.test.ts',
);

function read(path) {
  return readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory()
        ? listFiles(path)
        : [relative(moduleRoot, path).replaceAll('\\', '/')];
    })
    .sort();
}

function matches(source, pattern, message) {
  assert.match(source, pattern, message);
}

test('CAT05 local module inventory is exact and contains no unreviewed manifest or binary', () => {
  assert.deepEqual(listFiles(moduleRoot), [
    'expo-module.config.json',
    'index.ts',
    'ios/NativeLabelOcr.podspec',
    'ios/NativeLabelOcrModule.swift',
    'package.json',
    'src/NativeLabelOcr.types.ts',
    'src/NativeLabelOcrModule.ts',
  ]);
  assert.equal(existsSync(resolve(moduleRoot, 'ios/PrivacyInfo.xcprivacy')), false);
  assert.equal(
    listFiles(moduleRoot).some((path) => /\.(?:a|dylib|framework|xcframework)$/iu.test(path)),
    false,
  );
  assert.deepEqual(JSON.parse(read(resolve(moduleRoot, 'package.json'))), {
    name: 'native-label-ocr',
    version: '1.0.0',
    private: true,
    main: 'index.ts',
  });
});

test('CAT05 Expo registration is iOS-only and names one native module', () => {
  const config = JSON.parse(read(moduleConfigPath));
  assert.deepEqual(config, {
    platforms: ['ios'],
    apple: { modules: ['NativeLabelOcrModule'] },
  });

  const result = JSON.parse(
    execFileSync(
      process.execPath,
      [
        resolve(root, 'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js'),
        'resolve',
        '--platform',
        'apple',
        '--project-root',
        resolve(root, 'apps/mobile'),
        '--json',
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    ),
  );
  const descriptor = result.modules.find(({ packageName }) => packageName === 'native-label-ocr');
  assert.ok(descriptor, 'Expo autolinking did not discover native-label-ocr.');
  assert.deepEqual(
    descriptor.pods.map(({ podName }) => podName),
    ['NativeLabelOcr'],
  );
  assert.deepEqual(
    descriptor.modules.map(({ class: className }) => className),
    ['NativeLabelOcrModule'],
  );
});

test('CAT05 pod uses only ExpoModulesCore plus reviewed Apple system frameworks', () => {
  const podspec = read(podspecPath);
  matches(podspec, /s\.name\s*=\s*'NativeLabelOcr'/u, 'Pod name drifted.');
  matches(podspec, /s\.platforms\s*=\s*\{\s*:ios\s*=>\s*'17\.0'\s*\}/u, 'iOS floor drifted.');
  matches(podspec, /s\.swift_version\s*=\s*'5\.9'/u, 'Swift language version drifted.');
  matches(podspec, /s\.static_framework\s*=\s*true/u, 'The module must remain a static framework.');
  assert.deepEqual(
    [...podspec.matchAll(/s\.dependency\s+['"]([^'"]+)['"]/gu)].map((match) => match[1]),
    ['ExpoModulesCore'],
  );
  assert.deepEqual(
    [...podspec.matchAll(/s\.frameworks\s*=\s*([^\n]+)/gu)][0]?.[1]
      ?.match(/'([^']+)'/gu)
      ?.map((value) => value.slice(1, -1)),
    ['ImageIO', 'UniformTypeIdentifiers', 'Vision'],
  );
  assert.doesNotMatch(podspec, /vendored_|resource|PrivacyInfo|script_phase/iu);
});

test('CAT05 native bridge constants and JSON method names are pinned', () => {
  const swift = read(swiftPath);
  matches(swift, /Name\("NativeLabelOcr"\)/u, 'Native module name drifted.');
  const constants = [
    ['labelOcrContractVersion', 'labelOcrContractVersion'],
    ['labelOcrConfigured', 'true'],
    ['labelOcrEngine', 'labelOcrEngine'],
    ['labelOcrRequestRevision', 'Int\\(labelOcrRequestRevision\\)'],
    ['labelOcrRecognitionLevel', 'labelOcrRecognitionLevel'],
    ['labelOcrRunsOnDevice', 'true'],
  ];
  for (const [name, expression] of constants) {
    matches(
      swift,
      new RegExp(`Constant\\("${name}"\\) \\{ ${expression} \\}`, 'u'),
      `Native constant ${name} drifted.`,
    );
  }
  assert.equal([...swift.matchAll(/Constant\("/gu)].length, 6);
  matches(swift, /AsyncFunction\("recognizeLabelTextJSON"\)/u, 'Recognition method drifted.');
  matches(swift, /Function\("cancelLabelTextRecognitionJSON"\)/u, 'Cancellation method drifted.');

  const types = read(typesPath);
  for (const literal of [
    'labelOcrContractVersion: 1',
    'labelOcrConfigured: true',
    "labelOcrEngine: 'apple_vision_legacy'",
    'labelOcrRequestRevision: 3',
    "labelOcrRecognitionLevel: 'accurate'",
    'labelOcrRunsOnDevice: true',
    'recognizeLabelTextJSON:',
    'cancelLabelTextRecognitionJSON:',
  ]) {
    assert.ok(types.includes(literal), `TypeScript bridge contract is missing ${literal}.`);
  }
  matches(
    read(bridgePath),
    /requireOptionalNativeModule<NativeLabelOcrModule>\('NativeLabelOcr'\)/u,
    'The JavaScript bridge must fail safely when the native binary is absent.',
  );
});

test('CAT05 pins legacy Vision revision 3, accurate on-device recognition, and two candidates', () => {
  const swift = read(swiftPath);
  matches(swift, /labelOcrContractVersion\s*=\s*1/u, 'Contract version drifted.');
  matches(swift, /labelOcrEngine\s*=\s*"apple_vision_legacy"/u, 'Engine drifted.');
  matches(
    swift,
    /labelOcrRequestRevision\s*=\s*VNRecognizeTextRequestRevision3/u,
    'Vision revision drifted.',
  );
  matches(swift, /request\.recognitionLevel\s*=\s*\.accurate/u, 'Recognition level drifted.');
  matches(
    swift,
    /request\.automaticallyDetectsLanguage\s*=\s*true/u,
    'Automatic language detection must remain enabled.',
  );
  matches(
    swift,
    /request\.usesLanguageCorrection\s*=\s*false/u,
    'Unreviewed language correction must remain disabled for INCI text.',
  );
  matches(
    swift,
    /request\.customWords\s*=\s*\[\]/u,
    'Custom vocabulary must remain empty until QA.',
  );
  matches(swift, /request\.minimumTextHeight\s*=\s*0/u, 'Tiny text must not be filtered.');
  matches(
    swift,
    /request\.preferBackgroundProcessing\s*=\s*false/u,
    'Interactive recognition must retain foreground priority.',
  );
  matches(swift, /labelOcrMaximumCandidatesPerObservation\s*=\s*2/u, 'Candidate cap drifted.');
  matches(
    swift,
    /\.topCandidates\(labelOcrMaximumCandidatesPerObservation\)/u,
    'Vision candidates are not bounded.',
  );
});

test('CAT05 validates only managed cache JPEGs and applies orientation-safe downsampling', () => {
  const swift = read(swiftPath);
  for (const required of [
    'catalog-label-photo-temp-',
    'FileManager.default',
    '.cachesDirectory',
    '.isSymbolicLinkKey',
    '.isRegularFileKey',
    '.isReadableKey',
    '.fileSizeKey',
    'resolvingSymlinksInPath()',
    'imageType.conforms(to: .jpeg)',
    'CGImageSourceCreateThumbnailAtIndex',
    'kCGImageSourceCreateThumbnailWithTransform: true',
    'orientation: .up',
  ]) {
    assert.ok(swift.includes(required), `Native cache/image guard is missing ${required}.`);
  }
  matches(swift, /labelOcrMaximumFileBytes\s*=\s*20 \* 1_024 \* 1_024/u, 'File cap drifted.');
  matches(swift, /labelOcrMaximumSourcePixels:\s*Int64\s*=\s*80_000_000/u, 'Pixel cap drifted.');
  matches(swift, /labelOcrThumbnailMaximumPixelSize\s*=\s*4_096/u, 'Thumbnail cap drifted.');
});

test('CAT05 output, Unicode, concurrency, timeout, and cancellation are bounded', () => {
  const swift = read(swiftPath);
  for (const [pattern, message] of [
    [/labelOcrMaximumObservations\s*=\s*128/u, 'Observation cap drifted.'],
    [/labelOcrMaximumCandidateScalars\s*=\s*512/u, 'Candidate scalar cap drifted.'],
    [/labelOcrMaximumCandidateBytes\s*=\s*2_048/u, 'Candidate byte cap drifted.'],
    [
      /labelOcrMaximumAggregateCandidateBytes\s*=\s*64 \* 1_024/u,
      'Aggregate candidate cap drifted.',
    ],
    [/labelOcrMaximumResponseBytes\s*=\s*128 \* 1_024/u, 'Response byte cap drifted.'],
    [/labelOcrMaximumUriBytes\s*=\s*2_048/u, 'URI cap drifted.'],
    [/labelOcrTimeoutMilliseconds\s*=\s*12_000/u, 'Timeout drifted.'],
    [/private var activeJob:/u, 'Single active-job state is missing.'],
    [/NativeLabelOcrException\(\.busy/u, 'Concurrent requests are not rejected.'],
    [/requestToCancel\?\.cancel\(\)/u, 'Cancellation does not reach Vision.'],
    [
      /requestCancellation\(\s*requestId: job\.requestId,\s*expectedJob: job,\s*reason: \.timedOut\s*\)/u,
      'A stale timeout must remain bound to the exact native job that scheduled it.',
    ],
    [
      /\(expectedJob == nil \|\| job === expectedJob\)/u,
      'Internal cancellation must reject an identity mismatch even when a request ID is reused.',
    ],
    [/OnDestroy/u, 'Module teardown cancellation is missing.'],
    [/case noText = "no_text"/u, 'No-text status drifted.'],
    [/case cancelRequested = "cancel_requested"/u, 'Cancel response status drifted.'],
    [/\.sortedKeys/u, 'JSON encoding must remain deterministic.'],
    [
      /category == \.format && value != 0x200C && value != 0x200D/u,
      'Format-control filtering drifted.',
    ],
    [/0xFDD0\.\.\.0xFDEF/u, 'Unicode noncharacter filtering is missing.'],
    [/precomposedStringWithCanonicalMapping/u, 'NFC duplicate candidate filtering is missing.'],
    [
      /components\(separatedBy: \.whitespacesAndNewlines\)[\s\S]*joined\(separator: " "\)/u,
      'Native candidate whitespace normalization is missing.',
    ],
    [
      /LabelOcrCandidate\(text: normalizedText, confidence: confidence\)/u,
      'Native output must emit the same canonical candidate text used for dedupe.',
    ],
    [/LabelOcrActiveJob: @unchecked Sendable/u, 'Active-job concurrency annotation is missing.'],
  ]) {
    matches(swift, pattern, message);
  }
  matches(
    swift,
    /let tolerance = 0\.000_001[\s\S]*rawX >= -tolerance[\s\S]*rawMaxX <= 1 \+ tolerance/u,
    'Bounding boxes must reject material out-of-range geometry before clamping.',
  );
  assert.doesNotMatch(swift, /app\.onskin/iu);
  for (const field of [
    'schemaVersion',
    'requestId',
    'status',
    'truncated',
    'observations',
    'boundingBox',
    'candidates',
    'text',
    'confidence',
  ]) {
    assert.ok(swift.includes(field), `Response field ${field} is missing.`);
  }
});

test('CAT05 native source has no logging, network, persistence, or required-reason API surface', () => {
  const swift = read(swiftPath);
  const imports = [...swift.matchAll(/^import\s+([A-Za-z0-9_]+)/gmu)].map((match) => match[1]);
  assert.deepEqual(imports, [
    'CoreGraphics',
    'ExpoModulesCore',
    'Foundation',
    'ImageIO',
    'UniformTypeIdentifiers',
    'Vision',
  ]);

  const prohibited = [
    /URLSession/u,
    /URLRequest/u,
    /CFNetwork/u,
    /\bNetwork\b/u,
    /WebKit/u,
    /\bprint\s*\(/u,
    /\bdebugPrint\s*\(/u,
    /\bNSLog\s*\(/u,
    /\bos_log\b/u,
    /\bLogger\s*\(/u,
    /\.write\s*\(to:/u,
    /createFile/u,
    /moveItem/u,
    /copyItem/u,
    /removeItem/u,
    /UserDefaults/u,
    /contentModificationDate/u,
    /creationDate/u,
    /systemUptime/u,
    /\bf?stat\s*\(/u,
  ];
  for (const pattern of prohibited) {
    assert.doesNotMatch(swift, pattern);
  }
});

test('CAT05 app-boot cleanup snapshots only bounded raw Expo Camera orphans', () => {
  const source = read(startupCleanupPath);
  const lifecycle = read(labelPhotoLifecyclePath);
  matches(
    source,
    /EXPO_CAMERA_STARTUP_DELETE_LIMIT\s*=\s*32/u,
    'Raw Expo Camera cleanup must stay bounded to 32 direct children per pass.',
  );
  matches(
    source,
    /const EXPO_CAMERA_CACHE_DIRECTORY\s*=\s*'Camera'/u,
    'Raw startup cleanup must stay scoped to the Expo Camera cache directory.',
  );
  matches(
    lifecycle,
    /EXPO_CAMERA_CAPTURE_NAME\s*=\s*[\s\S]*?4\[0-9A-F\]\{3\}[\s\S]*?\[89AB\][\s\S]*?\\\.jpg\$\/u/iu,
    'The shared Camera trust boundary must accept only canonical v4 UUID.jpg names.',
  );
  matches(
    lifecycle,
    /export function isCanonicalExpoCameraCaptureName\([\s\S]*EXPO_CAMERA_CAPTURE_NAME\.test\(value\)/u,
    'The lifecycle must expose one exact Expo Camera filename predicate.',
  );
  matches(
    source,
    /import \{[\s\S]*isCanonicalExpoCameraCaptureName,[\s\S]*\} from '\.\/labelPhotoLifecycle';[\s\S]*readDirectoryAsync\(cameraDirectory\)[\s\S]*entries\.filter\(isCanonicalExpoCameraCaptureName\)/u,
    'Raw startup cleanup must reuse the lifecycle Camera filename predicate.',
  );
  matches(
    source,
    /\[\.\.\.remaining\]\.sort\(\)\.slice\(0, EXPO_CAMERA_STARTUP_DELETE_LIMIT\)/u,
    'Each raw cleanup pass must use the bounded boot snapshot.',
  );
  matches(
    source,
    /deleteAsync\(childUri\(cameraDirectory, name\), \{ idempotent: true \}\)/u,
    'Raw cleanup deletion must reconstruct only an allowlisted direct child URI.',
  );
  assert.equal(
    [...source.matchAll(/fileSystem\.readDirectoryAsync\(/gu)].length,
    1,
    'Raw cleanup must have one guarded Camera-directory listing call site.',
  );
  matches(
    source,
    /let snapshotAcquired = false;[\s\S]*if \(snapshotAcquired\) \{[\s\S]*return remainingBootNames;[\s\S]*\}/u,
    'The first successful startup snapshot must freeze every later drain pass.',
  );
  assert.equal(
    [...source.matchAll(/snapshotAcquired = true;/gu)].length,
    3,
    'Only no-cache-directory, absent-directory, and successful-listing acquisition may freeze.',
  );
  matches(
    source,
    /if \(!cacheDirectory\) \{[\s\S]*remainingBootNames = new Set\(\);[\s\S]*snapshotAcquired = true;[\s\S]*return remainingBootNames;[\s\S]*\}/u,
    'A successful no-cache-directory acquisition must freeze an empty snapshot.',
  );
  matches(
    source,
    /if \(!info\.exists\) \{[\s\S]*remainingBootNames = new Set\(\);[\s\S]*snapshotAcquired = true;[\s\S]*return remainingBootNames;[\s\S]*\}/u,
    'A successful absent-Camera-directory acquisition must freeze an empty snapshot.',
  );
  matches(
    source,
    /const entries = await fileSystem\.readDirectoryAsync\(cameraDirectory\);[\s\S]*remainingBootNames = new Set\([\s\S]*snapshotAcquired = true;[\s\S]*return remainingBootNames;/u,
    'An empty or populated successful listing must freeze only after its filtered snapshot exists.',
  );
  matches(
    source,
    /const scavenge = \(\): Promise<number> => \{[\s\S]*operationTail\.then\(run, run\)[\s\S]*operationTail = result\.then/u,
    'Snapshot acquisition, acquisition retry, and remaining-name deletion must stay serialized.',
  );
  matches(
    source,
    /scavengeStaleLabelPhotos\(labelPhotoFileSystem\)[\s\S]*expoCameraStartupScavenger\.scavenge\(\)/u,
    'App boot must drain both managed label photos and the frozen raw Expo Camera snapshot.',
  );
  matches(
    source,
    /async function runLabelPhotoStartupScavenge\(\): Promise<number> \{[\s\S]*await Promise\.allSettled\(\[[\s\S]*scavengeStaleLabelPhotos\(labelPhotoFileSystem\)[\s\S]*expoCameraStartupScavenger\.scavenge\(\)[\s\S]*\]\);[\s\S]*result\.status === 'rejected'[\s\S]*if \(failed\) throw failed\.reason;/u,
    'The combined pass must settle both managed and raw cleanup before exposing a retryable rejection.',
  );
  matches(
    source,
    /let state: 'not_started' \| 'pending' \| 'fulfilled' \| 'rejected' = 'not_started';[\s\S]*const start = \(\): Promise<number> => current \?\? launch\(\);[\s\S]*if \(current === null \|\| state === 'rejected'\) return launch\(\);[\s\S]*return current;/u,
    'The global coordinator must deduplicate pending work, retry only settled failure, and preserve success.',
  );
  assert.equal(
    [...source.matchAll(/current(?:\s*:\s*Promise<number> \| null)?\s*=\s*null/gu)].length,
    1,
    'The fulfilled coordinator promise must never be cleared for a post-success rescan.',
  );
  matches(
    source,
    /startLabelPhotoStartupScavenge\(\): Promise<number> \{[\s\S]*return startupCoordinator\.start\(\);[\s\S]*retryLabelPhotoStartupScavenge\(\): Promise<number> \{[\s\S]*return startupCoordinator\.retry\(\);/u,
    'Every route must share the same process-wide startup coordinator.',
  );
});

test('CAT05 label and Progress shutters await the shared boot drain before capture', () => {
  const labelCapture = read(labelCaptureRoutePath);
  const progressCapture = read(progressCaptureRoutePath);

  assert.equal(
    [...labelCapture.matchAll(/takePictureAsync\(/gu)].length,
    1,
    'The label route must expose one statically governed camera shutter.',
  );
  assert.equal(
    [...progressCapture.matchAll(/takePictureAsync\(/gu)].length,
    1,
    'The Progress route must expose one statically governed camera shutter.',
  );
  matches(
    labelCapture,
    /const capture = async \(\) => \{[\s\S]*?await labelPhotoStartupRef\.current;[\s\S]*?await cameraRef\.current!\.takePictureAsync\(/u,
    'The label shutter must observe the shared startup cleanup before creating a raw Camera file.',
  );
  matches(
    progressCapture,
    /async function capture\(\) \{[\s\S]*?await waitForLabelPhotoStartupScavenge\(\);[\s\S]*?await cameraRef\.current!\.takePictureAsync\(/u,
    'The Progress shutter must observe the shared startup cleanup before creating a raw Camera file.',
  );
  matches(
    progressCapture,
    /labelPhotoStartupCleanupFailedRef\.current[\s\S]*?retryLabelPhotoStartupScavenge\(\)[\s\S]*?: startLabelPhotoStartupScavenge\(\)/u,
    'Progress cleanup retry must reuse the snapshot-only startup scavenger.',
  );
});

test('CAT05 Progress capture lease delegates stale raw photos to its executable route boundary', () => {
  const source = read(progressCaptureRoutePath);
  const routeBoundary = read(progressCaptureRouteBoundaryPath);
  const routeBoundaryBehavior = read(progressCaptureRouteBoundaryTestPath);

  for (const declaration of [
    'const mountedRef = useRef(false);',
    'const captureLeaseGenerationRef = useRef(0);',
    'const captureInFlightRef = useRef<number | null>(null);',
    'let rawCaptureUri: string | null = null;',
  ]) {
    assert.ok(source.includes(declaration), `Progress capture lease is missing ${declaration}`);
  }
  matches(
    source,
    /return \(\) => \{[\s\S]*mountedRef\.current = false;[\s\S]*captureLeaseGenerationRef\.current \+= 1;/u,
    'Unmount must invalidate the active capture generation.',
  );
  matches(
    source,
    /if \(!cameraAccess\.isForegroundFocused\) captureLeaseGenerationRef\.current \+= 1;/u,
    'Blur or background must invalidate the active capture generation.',
  );
  matches(
    source,
    /function closeToProgress\(\) \{[\s\S]*captureLeaseGenerationRef\.current \+= 1;[\s\S]*captureBoundary\.requestProgressExit\(\);/u,
    'Explicit close must invalidate capture before protected navigation.',
  );
  matches(
    source,
    /const cameraOperation = usesNativeCamera \? cameraAccess\.beginCameraOperation\(\) : null;[\s\S]*if \(!captureBoundary\.beginShutter\(\)\) return;[\s\S]*const captureLease = \+\+captureLeaseGenerationRef\.current;[\s\S]*captureInFlightRef\.current = captureLease;/u,
    'A capture must acquire camera-session, route-boundary, and generation single-flight leases.',
  );
  matches(
    source,
    /await waitForLabelPhotoStartupScavenge\(\);[\s\S]*captureLeaseGenerationRef\.current !== captureLease[\s\S]*!cameraAccess\.isCameraOperationCurrent\(cameraOperation\)[\s\S]*return;[\s\S]*takePictureAsync\(/u,
    'A stale route or camera-session lease must return before opening the shutter.',
  );
  matches(
    source,
    /rawCaptureUri = trustedExpoCameraCaptureUri\(shot\.uri, FileSystem\.cacheDirectory\);[\s\S]*if \(rawCaptureUri === null\)[\s\S]*captureBoundary\.adoptRawCapture\(rawCaptureUri\);[\s\S]*captureLeaseGenerationRef\.current !== captureLease[\s\S]*!cameraAccess\.isCameraOperationCurrent\(cameraOperation\)[\s\S]*await captureBoundary\.retryCleanup\(\);[\s\S]*rawCaptureUri = null;[\s\S]*return;[\s\S]*track\('photo_capture_still_taken'/u,
    'A photo resolving after blur, background, close, or unmount must enter the retained cleanup lifecycle and drain before return or analytics.',
  );
  matches(
    source,
    /catch \{[\s\S]*if \(rawCaptureUri !== null\) \{[\s\S]*cleanupSucceeded = await captureBoundary\.retryCleanup\(\);[\s\S]*\}[\s\S]*if \(!cleanupSucceeded\)[\s\S]*return;[\s\S]*captureLeaseGenerationRef\.current === captureLease[\s\S]*!staleCameraOperation[\s\S]*setPhotoCaptureFailed\(true\);/u,
    'Capture failure must drain retained cleanup and may write failure UI only for the current route and camera session.',
  );
  assert.ok(
    !source.includes(
      'FileSystem.deleteAsync(rawCaptureUri, { idempotent: true }).catch(() => undefined)',
    ),
    'The route must not swallow raw-photo deletion failure outside the retained lifecycle.',
  );
  assert.ok(
    source.includes('createProgressCaptureRouteBoundary<NavigationAction>({') &&
      source.includes('usePreventRemove(!boundaryState.routeRemovalReady'),
    'Protected removal must remain armed until the route-owned boundary authorizes it.',
  );
  matches(
    routeBoundary,
    /const lifecycle = pendingRawCaptureLifecycle;[\s\S]*const operation = lifecycle\.discard\(\)\.then\([\s\S]*cleanupFailed: true, cleanupPending: true[\s\S]*return false;/u,
    'Delete failure must retain the lifecycle and expose cleanup retry state.',
  );
  matches(
    routeBoundary,
    /pendingRawCaptureLifecycle\?\.hasPendingCleanup\(\)[\s\S]*void retryCleanup\(\);[\s\S]*return;[\s\S]*markRouteRemovalReady\(\);/u,
    'Protected navigation must retry retained cleanup before authorizing removal.',
  );
  assert.ok(
    routeBoundaryBehavior.includes("from './progressCaptureRouteBoundary';"),
    'The executable boundary suite must import the production route coordinator.',
  );
  for (const executableContract of [
    'blocks a back removal while the shutter is pending, invalidates capture, then dispatches once',
    'retains a failed raw deletion, blocks navigation, then releases to the latest intent once',
    'transfers a review handoff exactly once without deleting or disposing its raw source',
    'returns route ownership after a non-review navigation handler throws',
    'keeps route-owned shutter and raw state while a replacing gate swaps child invalidators',
  ]) {
    assert.ok(
      routeBoundaryBehavior.includes(executableContract),
      `Progress route-boundary behavior coverage is missing ${executableContract}`,
    );
  }
});

test('CAT05 Progress review admits trusted Camera URIs and drains before protected removal', () => {
  const capture = read(progressCaptureRoutePath);
  const review = read(progressReviewRoutePath);
  const privacyHelper = read(progressCapturePrivacyPath);

  for (const exportedContract of [
    'export function trustedExpoCameraCaptureUri(',
    'export function createProgressCaptureReviewLifecycle(',
  ]) {
    assert.ok(
      privacyHelper.includes(exportedContract),
      `Progress capture privacy helper is missing ${exportedContract}`,
    );
  }
  matches(
    capture,
    /rawCaptureUri = trustedExpoCameraCaptureUri\(shot\.uri, FileSystem\.cacheDirectory\);[\s\S]*if \(rawCaptureUri === null\)[\s\S]*capturedUri: rawCaptureUri/u,
    'Progress capture must validate the raw Camera URI before deletion or review handoff.',
  );
  matches(
    review,
    /trustedExpoCameraCaptureUri\(params\.capturedUri, FileSystem\.cacheDirectory\)/u,
    'Progress review must revalidate its untrusted route parameter through the shared helper.',
  );
  matches(
    review,
    /<Image[\s\S]*source=\{\{ uri: capturedUri \}\}[\s\S]*cachePolicy="none"/u,
    'Progress review must never disk-cache the sensitive raw preview.',
  );
  const removalGuard = review.indexOf('usePreventRemove(source !== null && !routeRemovalReady');
  const protectedGates = review.indexOf('<ProGate feature="photo_timeline">');
  assert.ok(
    removalGuard >= 0 && protectedGates > removalGuard,
    'Raw-photo route-removal protection must live outside entitlement and storage gates.',
  );
  matches(
    review,
    /await lifecycle\.discard\(\);[\s\S]*pendingNavigationRef\.current = pending;[\s\S]*setRouteRemovalReady\(true\);/u,
    'Back, swipe, close, and Retake must finish raw cleanup before authorizing removal.',
  );
  matches(
    review,
    /if \(!routeRemovalReady\) return;[\s\S]*navigation\.dispatch\(pending\.action\)[\s\S]*router\.replace\('\/progress\/capture'\)[\s\S]*backOrReplace\(router, APP_PROGRESS_ROUTE\)/u,
    'Protected navigation must dispatch only after the cleanup-ready state is committed.',
  );
  matches(
    review,
    /await lifecycle\.save\(persist,[\s\S]*pendingNavigationRef\.current = \{ kind: 'progress' \};[\s\S]*setRouteRemovalReady\(true\);/u,
    'Save must await encrypted persistence and raw cleanup before route removal.',
  );
  assert.doesNotMatch(
    review,
    /FileSystem\.deleteAsync\(capturedUri/u,
    'The route must not bypass the trusted lifecycle with parameter-driven deletion.',
  );
});
