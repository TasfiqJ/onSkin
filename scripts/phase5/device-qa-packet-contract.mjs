export const PHASE5_DEVICE_QA_PACKET_SCHEMA_VERSION = 1;

export const PHASE5_REQUIRED_QA_EVIDENCE = Object.freeze(
  [
    ['PHASE5_DEVICE_QA_PASS', 'overall native-device QA matrix'],
    ['PHASE5_INSTALL_QA_PASS', 'fresh install, update, reinstall, and dev/staging variants'],
    ['PHASE5_BARCODE_QA_PASS', 'physical-device barcode scan and checksum matrix'],
    ['PHASE5_LABEL_CAPTURE_QA_PASS', 'real label capture, editable text, and manual fallback'],
    ['PHASE5_PROGRESS_PHOTO_QA_PASS', 'progress still capture, retake, review, and recovery'],
    [
      'PHASE5_ENCRYPTED_PHOTO_STORAGE_QA_PASS',
      'encrypted photo save, restart, key-missing recovery, and delete',
    ],
    ['PHASE5_NOTIFICATION_QA_PASS', 'iOS reminder delivery and permission behavior'],
    ['PHASE5_SHARE_SHEET_QA_PASS', 'native share sheet success, cancel, and unavailable states'],
    [
      'PHASE5_REVENUECAT_NATIVE_QA_PASS',
      'RevenueCat native configure, offering, purchase, and restore smoke',
    ],
    ['PHASE5_SENTRY_NATIVE_QA_PASS', 'Sentry native crash/source-map smoke'],
    [
      'PHASE5_SUPABASE_CATALOG_NATIVE_QA_PASS',
      'native Supabase catalog lookup and no-match/error fallback',
    ],
    ['PHASE5_ACCESSIBILITY_QA_PASS', 'VoiceOver labels, traversal, and 44 pt controls'],
    [
      'PHASE5_WIDGET_ARCHIVE_QA_PASS',
      'signed archive extension, App Group entitlement, target privacy manifest, and capability inspection',
    ],
    [
      'PHASE5_WIDGET_DEVICE_QA_PASS',
      'physical-iPhone widget families, cold-start deep links, process death, and accessibility',
    ],
    [
      'PHASE5_WIDGET_INTERACTION_PRIVACY_QA_PASS',
      'atomic widget interaction plus lock, expiry, sign-out, account-switch, and consent-withdrawal cleanup',
    ],
    [
      'PHASE5_LIVE_ACTIVITY_QA_PASS',
      'physical-iPhone Live Activity stale, end, process-death, restart, and locked-state behavior',
    ],
  ].map((entry) => Object.freeze(entry)),
);

export const PHASE5_REQUIRED_QA_EVIDENCE_KEYS = Object.freeze(
  PHASE5_REQUIRED_QA_EVIDENCE.map(([key]) => key),
);
