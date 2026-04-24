import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

vi.mock('../firebase/config', () => ({
  auth: {},
  db: {},
  functions: {},
  ai: {},
}));

import { httpsCallable } from 'firebase/functions';
import { decomposeCharacter } from './decompositionService';

const mockedHttpsCallable = vi.mocked(httpsCallable);

describe('decompositionService', () => {
  let mockCallable: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallable = vi.fn();
    mockedHttpsCallable.mockReturnValue(mockCallable as any);
  });

  it('returns components from the cloud function response', async () => {
    const components = [
      { char: '亻', meaning: 'person', pinyin: 'rén' },
      { char: '本', meaning: 'root; origin', pinyin: 'běn' },
    ];
    mockCallable.mockResolvedValue({ data: { components } });

    // Re-import to pick up the mock — the module-level httpsCallable call
    // happens at import time, so we need to dynamically import after mocking
    vi.resetModules();
    vi.doMock('firebase/functions', () => ({
      httpsCallable: () => mockCallable,
    }));
    vi.doMock('../firebase/config', () => ({
      auth: {},
      db: {},
      functions: {},
      ai: {},
    }));

    const { decomposeCharacter: freshDecompose } = await import('./decompositionService');

    const result = await freshDecompose('体');

    expect(mockCallable).toHaveBeenCalledWith({ char: '体' });
    expect(result).toEqual(components);
  });

  it('propagates errors from the cloud function', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Cloud function unavailable'));

    vi.resetModules();
    vi.doMock('firebase/functions', () => ({
      httpsCallable: () => mockFn,
    }));
    vi.doMock('../firebase/config', () => ({
      auth: {},
      db: {},
      functions: {},
      ai: {},
    }));

    const { decomposeCharacter: freshDecompose } = await import('./decompositionService');

    await expect(freshDecompose('体')).rejects.toThrow('Cloud function unavailable');
  });

  it('handles empty components array', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: { components: [] } });

    vi.resetModules();
    vi.doMock('firebase/functions', () => ({
      httpsCallable: () => mockFn,
    }));
    vi.doMock('../firebase/config', () => ({
      auth: {},
      db: {},
      functions: {},
      ai: {},
    }));

    const { decomposeCharacter: freshDecompose } = await import('./decompositionService');

    const result = await freshDecompose('一');
    expect(result).toEqual([]);
  });

  it('caches results so the cloud function is only called once per character', async () => {
    const components = [{ char: '十', meaning: 'ten', pinyin: 'shí' }];
    const mockFn = vi.fn().mockResolvedValue({ data: { components } });

    vi.resetModules();
    vi.doMock('firebase/functions', () => ({
      httpsCallable: () => mockFn,
    }));
    vi.doMock('../firebase/config', () => ({
      auth: {},
      db: {},
      functions: {},
      ai: {},
    }));

    const { decomposeCharacter: freshDecompose } = await import('./decompositionService');

    const result1 = await freshDecompose('木');
    const result2 = await freshDecompose('木');

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(result1).toEqual(components);
    expect(result2).toBe(result1);
  });

  it('handles components with null meaning and pinyin', async () => {
    const components = [{ char: '丶', meaning: null, pinyin: null }];
    const mockFn = vi.fn().mockResolvedValue({ data: { components } });

    vi.resetModules();
    vi.doMock('firebase/functions', () => ({
      httpsCallable: () => mockFn,
    }));
    vi.doMock('../firebase/config', () => ({
      auth: {},
      db: {},
      functions: {},
      ai: {},
    }));

    const { decomposeCharacter: freshDecompose } = await import('./decompositionService');

    const result = await freshDecompose('丶');
    expect(result).toEqual(components);
  });
});
