import { describe, it, expect } from 'vitest';
import React from 'react';
import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import Credits from './Credits';
import { renderWithProviders } from '../../test/utils';

describe('Credits', () => {
  it('names each source with its licence and a link', () => {
    renderWithProviders(<Credits />);

    expect(screen.getByRole('heading', { name: 'Credits' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tatoeba' })).toHaveAttribute(
      'href',
      'https://tatoeba.org',
    );
    expect(screen.getByRole('link', { name: 'CC BY 2.0 FR' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/2.0/fr/',
    );
    expect(screen.getByRole('link', { name: 'CC-CEDICT' })).toHaveAttribute(
      'href',
      'https://cc-cedict.org/wiki/',
    );
    expect(screen.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/4.0/',
    );
    expect(screen.getByRole('link', { name: 'complete-hsk-vocabulary' })).toHaveAttribute(
      'href',
      'https://github.com/drkameleon/complete-hsk-vocabulary',
    );
    expect(screen.getByRole('link', { name: 'MIT' })).toHaveAttribute(
      'href',
      '/premade-lists/LICENSE.txt',
    );
  });

  it('links to the credit of each sentence and the licence of the sentence files', () => {
    renderWithProviders(<Credits />);

    expect(screen.getByRole('link', { name: 'Sentence credits' })).toHaveAttribute(
      'href',
      '/sentences/ATTRIBUTION.txt',
    );
    expect(screen.getByRole('link', { name: 'Sentence licence' })).toHaveAttribute(
      'href',
      '/sentences/LICENSE.txt',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<Credits />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
