import { axe, AxeOptions } from 'vitest-axe';
import { renderWithProviders } from './utils';

/**
 * Render a component with providers and run axe-core accessibility checks.
 * Returns the axe results for assertion with toHaveNoViolations().
 */
export async function checkA11y(
  ui: React.ReactElement,
  options?: AxeOptions,
  storeState?: Record<string, unknown>,
) {
  const { container } = renderWithProviders(ui, { store: undefined, ...storeState });
  return axe(container, options);
}

export { axe };
