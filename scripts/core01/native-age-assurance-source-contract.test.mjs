import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const moduleRoot = resolve(root, 'apps/mobile/modules/native-age-assurance');
const moduleConfigPath = resolve(moduleRoot, 'expo-module.config.json');
const podspecPath = resolve(moduleRoot, 'ios/NativeAgeAssurance.podspec');
const swiftPath = resolve(moduleRoot, 'ios/NativeAgeAssuranceModule.swift');
const typesPath = resolve(moduleRoot, 'src/NativeAgeAssurance.types.ts');
const bridgePath = resolve(moduleRoot, 'src/NativeAgeAssuranceModule.ts');
const appConfigPath = resolve(root, 'apps/mobile/app.config.js');
const contractPath = resolve(
  root,
  'apps/mobile/src/features/onboarding/nativeAgeAssuranceContract.ts',
);
const iosAdapterPath = resolve(
  root,
  'apps/mobile/src/features/onboarding/nativeAgeAssuranceAdapter.ios.ts',
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

test('CORE01 local module inventory is exact and contains no binary or privacy manifest', () => {
  assert.deepEqual(listFiles(moduleRoot), [
    'expo-module.config.json',
    'index.ts',
    'ios/NativeAgeAssurance.podspec',
    'ios/NativeAgeAssuranceModule.swift',
    'package.json',
    'src/NativeAgeAssurance.types.ts',
    'src/NativeAgeAssuranceModule.ts',
  ]);
  assert.equal(existsSync(resolve(moduleRoot, 'ios/PrivacyInfo.xcprivacy')), false);
  assert.equal(
    listFiles(moduleRoot).some((path) => /\.(?:a|dylib|framework|xcframework)$/iu.test(path)),
    false,
  );
  assert.deepEqual(JSON.parse(read(resolve(moduleRoot, 'package.json'))), {
    name: 'native-age-assurance',
    version: '1.0.0',
    private: true,
    main: 'index.ts',
  });
});

test('CORE01 Expo registration is iOS-only and autolinks one first-party module', () => {
  assert.deepEqual(JSON.parse(read(moduleConfigPath)), {
    platforms: ['ios'],
    apple: { modules: ['NativeAgeAssuranceModule'] },
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
  const descriptor = result.modules.find(
    ({ packageName }) => packageName === 'native-age-assurance',
  );
  assert.ok(descriptor, 'Expo autolinking did not discover native-age-assurance.');
  assert.deepEqual(
    descriptor.pods.map(({ podName }) => podName),
    ['NativeAgeAssurance'],
  );
  assert.deepEqual(
    descriptor.modules.map(({ class: className }) => className),
    ['NativeAgeAssuranceModule'],
  );
});

test('CORE01 native config declares the Apple age-range entitlement', () => {
  const appConfig = read(appConfigPath);
  matches(
    appConfig,
    /'com\.apple\.developer\.declared-age-range': true/u,
    'Declared Age Range entitlement is missing from Expo iOS config.',
  );
  assert.equal([...appConfig.matchAll(/'com\.apple\.developer\.declared-age-range'/gu)].length, 1);
});

test('CORE01 pod has no third-party or bundled executable dependency', () => {
  const podspec = read(podspecPath);
  matches(podspec, /s\.name\s*=\s*'NativeAgeAssurance'/u, 'Pod name drifted.');
  matches(podspec, /s\.platforms\s*=\s*\{\s*:ios\s*=>\s*'17\.0'\s*\}/u, 'iOS floor drifted.');
  matches(podspec, /s\.swift_version\s*=\s*'5\.9'/u, 'Swift language version drifted.');
  matches(podspec, /s\.static_framework\s*=\s*true/u, 'The module must remain static.');
  assert.deepEqual(
    [...podspec.matchAll(/s\.dependency\s+['"]([^'"]+)['"]/gu)].map((match) => match[1]),
    ['ExpoModulesCore'],
  );
  assert.deepEqual(
    [...podspec.matchAll(/s\.frameworks\s*=\s*([^\n]+)/gu)][0]?.[1]
      ?.match(/'([^']+)'/gu)
      ?.map((value) => value.slice(1, -1)),
    ['UIKit'],
  );
  assert.doesNotMatch(podspec, /vendored_|resource|PrivacyInfo|script_phase/iu);
});

test('CORE01 native method is SDK- and runtime-guarded and uses the fixed 16 gate', () => {
  const swift = read(swiftPath);
  matches(swift, /Name\("NativeAgeAssurance"\)/u, 'Native module name drifted.');
  const constants = [
    ['ageAssuranceContractVersion', 'ageAssuranceContractVersion'],
    ['ageAssuranceReviewStatus', 'ageAssuranceReviewStatus'],
    ['ageAssuranceProvider', 'ageAssuranceProvider'],
    ['ageAssuranceMinimumAge', 'ageAssuranceMinimumAge'],
    ['ageAssuranceMinimumRuntime', 'ageAssuranceMinimumRuntime'],
    ['ageAssuranceMinimumSdk', 'ageAssuranceMinimumSdk'],
    ['ageAssuranceExactBirthDateCollected', 'false'],
  ];
  for (const [name, expression] of constants) {
    matches(
      swift,
      new RegExp(`Constant\\("${name}"\\) \\{ ${expression} \\}`, 'u'),
      `Native constant ${name} drifted.`,
    );
  }
  assert.equal([...swift.matchAll(/Constant\("/gu)].length, constants.length);
  matches(
    swift,
    /AsyncFunction\("requestDeclaredAgeRangeJSON"\)/u,
    'Declared age range method drifted.',
  );
  for (const [pattern, message] of [
    [/^#if canImport\(DeclaredAgeRange\)$/mu, 'DeclaredAgeRange SDK guard is missing.'],
    [/^import DeclaredAgeRange$/mu, 'DeclaredAgeRange framework import is missing.'],
    [/guard #available\(iOS 26\.2, \*\) else/u, 'iOS 26.2 runtime guard is missing.'],
    [
      /AgeRangeService\.shared\.isEligibleForAgeFeatures/u,
      'Regulatory eligibility check is missing.',
    ],
    [
      /AgeRangeService\.shared\.requestAgeRange\(\s*ageGates: ageAssuranceMinimumAge,\s*in: viewController\s*\)/u,
      'Declared age range request is not bound to the fixed minimum and presenter.',
    ],
    [
      /ageAssuranceMinimumAge\s*=\s*16/u,
      'The product minimum must remain 16 pending policy review.',
    ],
    [
      /appContext\?\.utilities\?\.currentViewController\(\)/u,
      'The Apple sheet requires a current view controller.',
    ],
    [/@MainActor\s+private var requestInFlight = false/u, 'Main-actor single flight is missing.'],
    [/case \.declinedSharing:/u, 'Sharing decline is not handled.'],
    [/case \.sharing\(let range\):/u, 'Shared range is not handled.'],
    [/@unknown default:/u, 'Future Apple response cases must fail closed.'],
  ]) {
    matches(swift, pattern, message);
  }

  matches(
    swift,
    /catch AgeRangeService\.Error\.notAvailable \{[\s\S]*availability: \.notAvailable/u,
    'Apple not-available errors must fail closed.',
  );
  assert.equal([...swift.matchAll(/requestAgeRange\(/gu)].length, 1);
  assert.equal([...swift.matchAll(/isEligibleForAgeFeatures/gu)].length, 1);
});

test('CORE01 maps every known declaration and communication-limit control', () => {
  const swift = read(swiftPath);
  const declarationCases = [
    'selfDeclared',
    'guardianDeclared',
    'checkedByOtherMethod',
    'guardianCheckedByOtherMethod',
    'governmentIDChecked',
    'guardianGovernmentIDChecked',
    'paymentChecked',
    'guardianPaymentChecked',
  ];
  for (const value of declarationCases) {
    assert.ok(swift.includes(`case .${value}:`), `Apple declaration ${value} is not mapped.`);
  }
  matches(
    swift,
    /range\.activeParentalControls\.contains\(\.communicationLimits\)/u,
    'Communication Limits control is not mapped.',
  );
  matches(
    swift,
    /anyEnabled: !range\.activeParentalControls\.isEmpty/u,
    'Aggregate parental-control state is not mapped.',
  );
});

test('CORE01 native response is deterministic, request-bound, and contains no exact age', () => {
  const swift = read(swiftPath);
  const responseBody = swift.match(
    /private struct AgeAssuranceResponse: Encodable \{([\s\S]*?)\n\}/u,
  )?.[1];
  assert.ok(responseBody, 'Native response schema is missing.');
  assert.deepEqual(
    [...responseBody.matchAll(/^\s+let ([A-Za-z0-9_]+):/gmu)].map((match) => match[1]),
    [
      'schemaVersion',
      'requestId',
      'availability',
      'regulatoryEligibility',
      'sharingStatus',
      'ageRange',
      'declaration',
      'parentalControls',
    ],
  );
  for (const required of [
    'lowerBound: range.lowerBound',
    'upperBound: range.upperBound',
    'identifier.uuidString.lowercased() == value',
    'encoder.outputFormatting = [.sortedKeys]',
  ]) {
    assert.ok(swift.includes(required), `Native boundary is missing ${required}.`);
  }
  assert.doesNotMatch(
    swift,
    /\bdateOfBirth\b|\bexactAge\b|\bbirthYear\b|\bbirthMonth\b|\bbirthDay\b/iu,
  );
});

test('CORE01 source performs no logging, networking, or persistence', () => {
  const swift = read(swiftPath);
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
    /UserDefaults/u,
    /Keychain/u,
    /SecItem/u,
    /\.write\s*\(to:/u,
    /createFile/u,
    /moveItem/u,
    /copyItem/u,
    /removeItem/u,
  ];
  for (const pattern of prohibited) assert.doesNotMatch(swift, pattern);
});

test('CORE01 TypeScript bridge pins the native contract but remains literally launch-blocked', () => {
  const types = read(typesPath);
  const bridge = read(bridgePath);
  const contract = read(contractPath);
  const adapter = read(iosAdapterPath);

  for (const literal of [
    'ageAssuranceContractVersion: 1',
    "ageAssuranceReviewStatus: 'launch_blocked'",
    "ageAssuranceProvider: 'apple_declared_age_range'",
    'ageAssuranceMinimumAge: 16',
    "ageAssuranceMinimumRuntime: 'iOS 26.2'",
    "ageAssuranceMinimumSdk: 'iOS 26.2'",
    'ageAssuranceExactBirthDateCollected: false',
    'requestDeclaredAgeRangeJSON: (requestId: string) => Promise<string>',
  ]) {
    assert.ok(types.includes(literal), `Type contract drifted at ${literal}.`);
  }
  matches(
    bridge,
    /requireOptionalNativeModule<NativeAgeAssuranceModule>\('NativeAgeAssurance'\)/u,
    'Optional Expo module loader drifted.',
  );
  matches(
    contract,
    /NATIVE_AGE_ASSURANCE_REVIEW_STATUS = 'launch_blocked'/u,
    'Review status must remain launch-blocked.',
  );
  matches(
    contract,
    /response\.ageRange\.lowerBound === null[\s\S]*response\.ageRange\.lowerBound < NATIVE_AGE_ASSURANCE_MINIMUM_AGE/u,
    'Access must use only the lower bound.',
  );
  matches(
    adapter,
    /throw new Error\(NATIVE_AGE_ASSURANCE_LAUNCH_BLOCKED\);/u,
    'Production invocation needs a literal closed gate.',
  );
  assert.doesNotMatch(adapter, /await\s+nativeModule\.requestDeclaredAgeRangeJSON/u);
});
