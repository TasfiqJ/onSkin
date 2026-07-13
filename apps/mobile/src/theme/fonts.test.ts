import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type FontAsset = {
  id: string;
  tailwindToken: string;
  postScriptName: string;
  source: string;
  weight: number;
  style: 'normal' | 'italic';
};

type ExpoFontPluginOptions = {
  ios: { fonts: string[] };
  android: {
    fonts: {
      fontFamily: string;
      fontDefinitions: {
        path: string;
        weight: number;
        style: 'normal' | 'italic';
      }[];
    }[];
  };
};

const MOBILE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SOURCE_ROOT = resolve(MOBILE_ROOT, 'src');
const requireMobile = createRequire(resolve(MOBILE_ROOT, 'package.json'));
const { FONT_ASSETS, FONT_FAMILY_TOKENS, createExpoFontPluginOptions } = requireMobile(
  './font-assets',
) as {
  FONT_ASSETS: FontAsset[];
  FONT_FAMILY_TOKENS: Record<string, string>;
  createExpoFontPluginOptions: () => ExpoFontPluginOptions;
};

const EXPECTED_FACES = [
  ['serif', 'InstrumentSerif-Regular', 400, 'normal'],
  ['serif-italic', 'InstrumentSerif-Italic', 400, 'italic'],
  ['sans', 'HankenGrotesk-Regular', 400, 'normal'],
  ['sans-medium', 'HankenGrotesk-Medium', 500, 'normal'],
  ['sans-semibold', 'HankenGrotesk-SemiBold', 600, 'normal'],
  ['sans-bold', 'HankenGrotesk-Bold', 700, 'normal'],
  ['mono', 'IBMPlexMono-Regular', 400, 'normal'],
  ['mono-medium', 'IBMPlexMono-Medium', 500, 'normal'],
] as const;

const LEGACY_RUNTIME_ALIASES = [
  'InstrumentSerif_400Regular',
  'InstrumentSerif_400Regular_Italic',
  'HankenGrotesk_400Regular',
  'HankenGrotesk_500Medium',
  'HankenGrotesk_600SemiBold',
  'HankenGrotesk_700Bold',
  'IBMPlexMono_400Regular',
  'IBMPlexMono_500Medium',
];

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = resolve(directory, entry);
      if (statSync(path).isDirectory()) return collectSourceFiles(path);
      return /\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') ? [path] : [];
    })
    .sort();
}

function tableOffset(font: Buffer, tag: string): number {
  const tableCount = font.readUInt16BE(4);
  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + index * 16;
    if (font.toString('ascii', recordOffset, recordOffset + 4) === tag) {
      return font.readUInt32BE(recordOffset + 8);
    }
  }
  throw new Error(`Font is missing its ${tag} table.`);
}

function decodeName(bytes: Buffer, platformId: number): string {
  if (platformId === 0 || platformId === 3) {
    if (bytes.length % 2 !== 0) throw new Error('Invalid UTF-16 font name length.');
    return Buffer.from(bytes).swap16().toString('utf16le');
  }
  return bytes.toString('latin1');
}

function postScriptNames(font: Buffer): Set<string> {
  const nameOffset = tableOffset(font, 'name');
  const nameCount = font.readUInt16BE(nameOffset + 2);
  const stringsOffset = nameOffset + font.readUInt16BE(nameOffset + 4);
  const names = new Set<string>();

  for (let index = 0; index < nameCount; index += 1) {
    const recordOffset = nameOffset + 6 + index * 12;
    const platformId = font.readUInt16BE(recordOffset);
    const nameId = font.readUInt16BE(recordOffset + 6);
    if (nameId !== 6) continue;
    const length = font.readUInt16BE(recordOffset + 8);
    const offset = font.readUInt16BE(recordOffset + 10);
    names.add(
      decodeName(
        font.subarray(stringsOffset + offset, stringsOffset + offset + length),
        platformId,
      ),
    );
  }

  return names;
}

describe('minimal font asset contract', () => {
  it('embeds exactly the eight intentional faces under their real PostScript names', () => {
    expect(
      FONT_ASSETS.map((font) => [font.tailwindToken, font.postScriptName, font.weight, font.style]),
    ).toEqual(EXPECTED_FACES);
    expect(new Set(FONT_ASSETS.map((font) => font.source)).size).toBe(8);
    expect(new Set(FONT_ASSETS.map((font) => font.postScriptName)).size).toBe(8);

    let totalBytes = 0;
    for (const font of FONT_ASSETS) {
      expect(font.source).toMatch(/^@expo-google-fonts\/.+\/.+\/.+\.(ttf|otf)$/);
      const path = requireMobile.resolve(font.source);
      const bytes = readFileSync(path);
      totalBytes += bytes.byteLength;
      expect(postScriptNames(bytes)).toContain(font.postScriptName);
    }
    expect(totalBytes).toBeLessThan(700_000);
  });

  it('uses the same manifest for Expo embedding and NativeWind tokens', () => {
    const options = createExpoFontPluginOptions();
    expect(options.ios.fonts).toEqual(FONT_ASSETS.map((font) => font.source));
    expect(options.android.fonts).toEqual(
      FONT_ASSETS.map((font) => ({
        fontFamily: font.postScriptName,
        fontDefinitions: [{ path: font.source, weight: 400, style: 'normal' }],
      })),
    );

    const buildAppConfig = requireMobile('./app.config') as () => {
      expo: { plugins?: unknown[] };
    };
    const expo = buildAppConfig().expo;
    const expoFont = expo.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-font',
    );
    expect(expoFont).toEqual(['expo-font', options]);

    const tailwind = requireMobile('./tailwind.config') as {
      theme: { extend: { fontFamily: Record<string, string[]> } };
    };
    for (const [token, family] of Object.entries(FONT_FAMILY_TOKENS)) {
      expect(tailwind.theme.extend.fontFamily[token]).toEqual([family]);
    }
  });

  it('keeps Google-font imports direct and removes the native mount gate', () => {
    const webFonts = readFileSync(resolve(SOURCE_ROOT, 'theme/fonts.web.ts'), 'utf8');
    const directImports = webFonts.match(/from '@expo-google-fonts\/[^']+\/[^']+'/g) ?? [];
    expect(directImports).toHaveLength(8);
    expect(webFonts).not.toMatch(/from '@expo-google-fonts\/[^/'"]+['"]/);

    const nativeLoader = readFileSync(resolve(SOURCE_ROOT, 'theme/fontLoader.ts'), 'utf8');
    expect(nativeLoader).not.toMatch(/from ['"]expo-font['"]/);
    expect(nativeLoader).not.toContain('@expo-google-fonts');

    const rootLayout = readFileSync(resolve(SOURCE_ROOT, 'app/_layout.tsx'), 'utf8');
    expect(rootLayout).toContain('useFontDecision()');
    expect(rootLayout).not.toContain('useFonts(');
    expect(rootLayout).not.toMatch(/if\s*\(!fontDecisionComplete\)\s*return null/);

    const runtimeSource = collectSourceFiles(SOURCE_ROOT)
      .filter((path) => !path.endsWith('fonts.web.ts'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    for (const alias of LEGACY_RUNTIME_ALIASES) {
      expect(runtimeSource).not.toMatch(
        new RegExp(`fontFamily\\s*:\\s*['\"]${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      );
    }
  });
});
