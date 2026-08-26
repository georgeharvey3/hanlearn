import { axe } from 'vitest-axe';
import { renderWithProviders, createTestStore } from './utils';

// vitest-axe does not export its options type, so read it from the axe signature.
type AxeOptions = Parameters<typeof axe>[1];

/**
 * Render a component with providers and run axe-core accessibility checks.
 * Returns the axe results for assertion with toHaveNoViolations().
 */
export async function checkA11y(
  ui: React.ReactElement,
  options?: AxeOptions,
  storeState?: Record<string, unknown>,
) {
  const store = storeState ? createTestStore(storeState) : undefined;
  const { container } = renderWithProviders(ui, { store });
  return axe(container, options);
}

export { axe };
