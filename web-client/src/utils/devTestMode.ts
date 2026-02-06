/**
 * Development testing utilities for TestWords component stages.
 *
 * Usage: Add query params to the URL when running locally:
 *   - ?devStage=new      - Test NewWords component
 *   - ?devStage=vocab    - Test the main Test/vocab component
 *   - ?devStage=read     - Test SentenceRead component
 *   - ?devStage=write    - Test SentenceWrite component
 *   - ?devStage=summary  - Test TestSummary component within Test
 *
 * All stages require authentication and use words from the user's word bank.
 *
 * Examples:
 *   http://localhost:3000/test-words?devStage=read
 *   http://localhost:3000/test-words?devStage=summary
 */

export type DevStage = 'new' | 'vocab' | 'read' | 'write' | 'summary' | null;

export interface DevTestConfig {
  stage: DevStage;
  testFinished: boolean;
}

/**
 * Parse URL query params to determine dev testing mode
 */
export function getDevTestConfig(): DevTestConfig | null {
  // Only enable in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const devStage = params.get('devStage') as DevStage;

  if (!devStage) {
    return null;
  }

  const validStages: DevStage[] = ['new', 'vocab', 'read', 'write', 'summary'];
  if (!validStages.includes(devStage)) {
    console.warn(`Invalid devStage: ${devStage}. Valid options: ${validStages.join(', ')}`);
    return null;
  }

  return {
    stage: devStage,
    testFinished: devStage === 'summary',
  };
}

/**
 * Check if dev test mode is active
 */
export function isDevTestMode(): boolean {
  return getDevTestConfig() !== null;
}

/**
 * Get the initial stage for dev testing
 */
export function getDevStage(): DevStage {
  const config = getDevTestConfig();
  return config?.stage ?? null;
}
