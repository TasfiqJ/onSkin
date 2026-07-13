// The native bundle intentionally has no Google-font asset imports. Native
// faces are embedded by apps/mobile/app.config.js; web imports live in
// fonts.web.ts so Metro can resolve only the eight direct face subpaths there.
export { FONT_FAMILY_TOKENS as fontFamilies } from '../../font-assets';
