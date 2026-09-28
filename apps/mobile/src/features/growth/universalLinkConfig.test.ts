import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type AssociationComponent = Readonly<{
  '/': string;
  exclude?: boolean;
  comment?: string;
}>;

type AssociationFile = Readonly<{
  applinks: Readonly<{
    apps?: readonly string[];
    details: readonly Readonly<{
      appIDs: readonly string[];
      components: readonly AssociationComponent[];
    }>[];
  }>;
}>;

const associationTemplatePath = fileURLToPath(
  new URL(
    '../../../../../docs/phase-8/public-site/.well-known/apple-app-site-association.template.json',
    import.meta.url,
  ),
);

describe('iOS Universal Link association template', () => {
  it('is valid JSON and delegates only share paths to the final app identifier', () => {
    const association = JSON.parse(
      readFileSync(associationTemplatePath, 'utf8'),
    ) as AssociationFile;

    expect(association.applinks.apps ?? []).toEqual([]);
    expect(association.applinks.details).toHaveLength(1);
    expect(association.applinks.details[0]?.appIDs).toEqual([
      'APPLE_TEAM_ID.FINAL_IOS_BUNDLE_IDENTIFIER',
    ]);
    expect(association.applinks.details[0]?.components).toEqual([
      {
        '/': '/s/*',
        comment: 'Shelf Conflict Card public share links',
      },
      {
        '/': '/*',
        exclude: true,
        comment: 'Keep non-share marketing pages in the browser',
      },
    ]);
  });

  it('contains no wildcard app identifier, domain, query, or fragment admission', () => {
    const source = readFileSync(associationTemplatePath, 'utf8');

    expect(source).not.toContain('*.');
    expect(source).not.toContain('layerwell.');
    expect(source).not.toContain('"?"');
    expect(source).not.toContain('"#"');
  });
});
