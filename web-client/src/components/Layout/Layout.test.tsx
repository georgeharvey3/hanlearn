import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';

import Layout from './Layout';
import { useFocusMode } from './focusMode';
import { renderWithProviders } from '../../test/utils';

/** Make every media query match, or none, as a phone or a desktop would. */
const stubScreen = (phone: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: phone,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
};

const Session: React.FC = () => {
  useFocusMode(true);
  return <div>session</div>;
};

describe('Layout focus mode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides the navigation for a session on a phone', () => {
    stubScreen(true);
    renderWithProviders(
      <Layout>
        <Session />
      </Layout>,
    );
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('keeps the navigation for a session on a wider screen', () => {
    stubScreen(false);
    renderWithProviders(
      <Layout>
        <Session />
      </Layout>,
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
