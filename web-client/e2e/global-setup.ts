/**
 * Playwright global setup: verifies Firebase emulators are running before tests start.
 */
async function globalSetup(): Promise<void> {
  const endpoints = [
    { name: 'Firestore emulator', url: 'http://localhost:8082/' },
    { name: 'Auth emulator', url: 'http://localhost:9099/' },
    { name: 'Functions emulator', url: 'http://localhost:5001/' },
  ];

  for (const { name, url } of endpoints) {
    try {
      // Just verify connectivity — some emulators return 404 at root
      await fetch(url);
    } catch (error) {
      throw new Error(
        `${name} is not running at ${url}. ` +
          'Start emulators with "npm run emulators" from the repo root before running E2E tests.',
      );
    }
  }
}

export default globalSetup;
