/**
 * Seed helpers for e2e tests.
 * All e2e tests should use the Firebase emulator (localhost:9099 / localhost:8082).
 * Call seedTestUser() in beforeEach to get a fresh authenticated user.
 */

export const TEST_USER = {
  email: 'testuser@hanlearn.test',
  password: 'testpassword123',
  uid: 'e2e-test-user',
};

/**
 * Returns headers/credentials needed to hit the Firebase emulator REST API.
 * Use this to pre-seed Firestore data via fetch() in test setup.
 */
export function emulatorFirestoreUrl(path: string): string {
  return `http://localhost:8082/v1/projects/hanlearn-demo/databases/(default)/documents/${path}`;
}
