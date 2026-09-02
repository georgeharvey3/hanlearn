import { defineConfig } from 'vitest/config';

/**
 * The rules suite runs against the Firestore emulator, which one call to
 * `firebase emulators:exec` starts and stops around it. Threads are off because
 * every test shares that one emulator and the rules under test are global to it.
 */
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    pool: 'threads',
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
