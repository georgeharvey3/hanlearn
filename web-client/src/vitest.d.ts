import type { AxeMatchers } from 'vitest-axe';

// setupTests.ts registers the vitest-axe matchers. The types that vitest-axe
// ships augment the namespace of vitest 1, so the augmentation is here.
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<T = unknown> extends AxeMatchers {}
}
