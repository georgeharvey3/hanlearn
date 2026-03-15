import { axe, AxeOptions } from 'vitest-axe';
import { renderWithProviders, createTestStore } from './utils';

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
