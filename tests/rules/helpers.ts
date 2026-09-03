import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The port firebase.json gives the Firestore emulator. */
const FIRESTORE_PORT = 8082;

/**
 * A test environment holding the rules as the repository has them.
 *
 * The project id is a `demo-` one, which keeps the SDK offline: it never
 * reaches for credentials and never touches a real project.
 */
export async function loadRules(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-hanlearn',
    firestore: {
      rules: fs.readFileSync(path.join(here, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: FIRESTORE_PORT,
    },
  });
}

/** The Firestore a signed-in user sees, with the rules applied. */
export function asUser(env: RulesTestEnvironment, userId: string): Firestore {
  return env.authenticatedContext(userId).firestore() as unknown as Firestore;
}
