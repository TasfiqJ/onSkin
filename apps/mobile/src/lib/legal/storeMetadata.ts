export const STORE_METADATA_DRAFT = {
  appName: 'OnSkin',
  subtitle: 'Skincare routine, shelf, and progress.',
  shortDescription:
    'Build a calmer skincare routine, keep your shelf organized, compare progress photos, and understand possible product-order conflicts without scores or medical claims.',
  keywords: [
    'skincare',
    'routine',
    'shelf',
    'progress photos',
    'ingredient compatibility',
    'reminders',
  ],
  longDescriptionBullets: [
    'Keep your skincare products in one private shelf.',
    'Build AM and PM routines in a clear order.',
    'Get conservative routine-conflict flags.',
    'Compare your own progress photos under similar conditions.',
    'Keep photos on device by default.',
    'See recommendations by fit and evidence, not commission.',
    'Paid links, when enabled, are clearly disclosed.',
  ],
  screenshotCaptions: [
    'Your shelf, in one place.',
    "Tonight's routine, in order.",
    'Possible routine conflict.',
    'Progress photos, no scores.',
    'Paid links are disclosed.',
  ],
  reviewNotes:
    'OnSkin is a skincare routine organization app. It does not diagnose, treat, cure, prevent, or detect medical conditions. Progress photos have no score, skin age, grade, or disease detection.',
  prohibitedLaunchClaims: [
    'Treat acne.', // phase3-audit-allow intentional negative example
    'Diagnose your skin.', // phase3-audit-allow intentional negative example
    'Clinical AI analysis.', // phase3-audit-allow intentional negative example
    'Skin score improved.', // phase3-audit-allow intentional negative example
    'Dermatologist-grade recommendations.', // phase3-audit-allow intentional negative example
  ],
} as const;

export const STORE_METADATA_LIMITS = {
  ios: {
    appName: 30,
    subtitle: 30,
    promotionalText: 170,
    keywords: 100,
    description: 4000,
    screenshotCaption: 80,
  },
  googlePlay: {
    title: 30,
    shortDescription: 80,
    fullDescription: 4000,
    screenshotCaption: 80,
  },
} as const;

export const PHASE8_STORE_METADATA_PACKET = {
  ios: {
    appName: 'OnSkin',
    subtitle: 'Routine and shelf tracker',
    promotionalText:
      'Build a calmer skincare routine, organize your shelf, and compare your own progress photos without scores.',
    keywords: 'skincare,routine,shelf,progress,reminders,products',
    description: [
      'OnSkin helps you keep a calmer skincare routine.',
      '',
      'Plan AM and PM steps, keep your products in one shelf, and see conservative routine-conflict flags for reviewed rules.',
      '',
      'Progress photos are private by default and designed for side-by-side comparison under similar conditions. OnSkin does not grade your photos or estimate age.',
      '',
      'Recommendations are separated from commerce. Paid links, when enabled, are disclosed.',
      '',
      'OnSkin provides general cosmetic information only and is not medical advice.',
    ].join('\n'),
    screenshotCaptions: [
      'Your shelf, in one place.',
      'Tonight routine, in order.',
      'Reviewed shelf conflict.',
      'Progress photos, no scores.',
      'Privacy controls and export.',
    ],
    reviewNotes:
      'OnSkin is a cosmetic routine organization app. It does not diagnose, treat, cure, prevent, or detect medical conditions. Progress photos have no score, skin age, grade, or disease detection. Account deletion and data export are available from the You tab.',
  },
  googlePlay: {
    title: 'OnSkin',
    shortDescription: 'Build a calmer skincare routine, shelf, reminders, and progress log.',
    fullDescription: [
      'OnSkin helps you keep a calmer skincare routine.',
      '',
      'Use it to organize your product shelf, build AM and PM routines, check reviewed product-order conflicts, and compare your own progress photos under similar conditions.',
      '',
      'No cosmetic scores. No age estimate. No medical condition screening. Photos stay on device by default, with separate controls for backup, export, and deletion.',
      '',
      'Recommendations are separated from commerce, and paid links are disclosed when enabled.',
      '',
      'OnSkin provides general cosmetic information only and is not medical advice.',
    ].join('\n'),
    screenshotCaptions: [
      'Organize your shelf.',
      'Follow AM and PM routines.',
      'Review product-order conflicts.',
      'Compare progress without scores.',
      'Control privacy, export, and deletion.',
    ],
    reviewerNotes:
      'The app requires account, subscription, camera, notification, and privacy-control review. Test credentials and purchase testing notes belong in the store submission packet, not in public metadata.',
  },
} as const;

const PUBLIC_CLAIM_BLOCKLIST = [
  /\b(treat|cure|heal|prevent|diagnos|detect)\w*\b/i,
  /\b(acne|eczema|rosacea|psoriasis|dermatitis|melasma)\b/i,
  /\bclinically\s+proven\b/i,
  /\bdermatologist-grade\b/i,
  /\bai\s+(skin|analysis|dermatologist|diagnos\w*)\b/i,
  /\bskin\s*(score|age|health)\b/i,
] as const;

function hasBlockedClaim(text: string): boolean {
  return PUBLIC_CLAIM_BLOCKLIST.some((pattern) => pattern.test(text));
}

export function validateStoreMetadataPacket(
  packet = PHASE8_STORE_METADATA_PACKET,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (packet.ios.appName.length > STORE_METADATA_LIMITS.ios.appName) {
    errors.push('iOS app name exceeds 30 characters.');
  }
  if (packet.ios.subtitle.length > STORE_METADATA_LIMITS.ios.subtitle) {
    errors.push('iOS subtitle exceeds 30 characters.');
  }
  if (packet.ios.promotionalText.length > STORE_METADATA_LIMITS.ios.promotionalText) {
    errors.push('iOS promotional text exceeds 170 characters.');
  }
  if (packet.ios.keywords.length > STORE_METADATA_LIMITS.ios.keywords) {
    errors.push('iOS keywords exceed 100 characters.');
  }
  if (packet.ios.description.length > STORE_METADATA_LIMITS.ios.description) {
    errors.push('iOS description exceeds 4000 characters.');
  }
  if (packet.googlePlay.title.length > STORE_METADATA_LIMITS.googlePlay.title) {
    errors.push('Google Play title exceeds 30 characters.');
  }
  if (packet.googlePlay.shortDescription.length > STORE_METADATA_LIMITS.googlePlay.shortDescription) {
    errors.push('Google Play short description exceeds 80 characters.');
  }
  if (packet.googlePlay.fullDescription.length > STORE_METADATA_LIMITS.googlePlay.fullDescription) {
    errors.push('Google Play full description exceeds 4000 characters.');
  }

  const publicStrings = [
    packet.ios.appName,
    packet.ios.subtitle,
    packet.ios.promotionalText,
    packet.ios.keywords,
    packet.ios.description,
    ...packet.ios.screenshotCaptions,
    packet.googlePlay.title,
    packet.googlePlay.shortDescription,
    packet.googlePlay.fullDescription,
    ...packet.googlePlay.screenshotCaptions,
  ];
  for (const text of publicStrings) {
    if (hasBlockedClaim(text)) errors.push(`Public store metadata contains a blocked claim: "${text.slice(0, 80)}"`);
  }

  for (const caption of [...packet.ios.screenshotCaptions, ...packet.googlePlay.screenshotCaptions]) {
    if (caption.length > STORE_METADATA_LIMITS.ios.screenshotCaption) {
      errors.push(`Screenshot caption exceeds 80 characters: "${caption}"`);
    }
  }

  if (!/does not diagnose/i.test(packet.ios.reviewNotes)) {
    warnings.push('iOS review notes should state the medical boundary.');
  }
  if (!/test credentials/i.test(packet.googlePlay.reviewerNotes)) {
    warnings.push('Google Play reviewer notes should reference test credentials.');
  }

  return { errors, warnings };
}
