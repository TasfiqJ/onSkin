// Minimal class-name joiner (clsx-lite). Variants are designed not to set
// conflicting Tailwind utilities, so no merge/dedupe is needed.
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
