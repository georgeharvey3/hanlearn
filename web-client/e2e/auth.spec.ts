import { test, expect } from '@playwright/test';
import { clearEmulatorData, seedTestUser, TEST_USER, configureTestSettings } from './fixtures/seed';
import { AuthPage } from './pages/auth.page';

test.describe('Auth flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearEmulatorData();
    await configureTestSettings(page);
  });

  test('register a new account', async ({ page }) => {
    await page.goto('/');
    const auth = new AuthPage(page);

    await auth.openLoginModal();
    await auth.switchToRegister();
    await auth.register('newuser@hanlearn.test', 'newpassword123');

    // Should be logged in and see authenticated content
    await auth.expectLoggedIn();
  });

  test('login with existing account', async ({ page }) => {
    await seedTestUser();
    await page.goto('/');
    const auth = new AuthPage(page);

    await auth.openLoginModal();
    await auth.login(TEST_USER.email, TEST_USER.password);

    await auth.expectLoggedIn();
  });

  test('logout', async ({ page }) => {
    await seedTestUser();
    await page.goto('/');
    const auth = new AuthPage(page);

    await auth.openLoginModal();
    await auth.login(TEST_USER.email, TEST_USER.password);
    await auth.expectLoggedIn();

    await auth.logout();
    await auth.expectLoggedOut();
  });

  test('show error for invalid credentials', async ({ page }) => {
    await page.goto('/');
    const auth = new AuthPage(page);

    await auth.openLoginModal();
    await auth.login('nonexistent@hanlearn.test', 'wrongpassword');

    // Should show an error message (Firebase auth emulator returns "No account found...")
    await expect(page.getByText(/invalid|wrong|no account|not found|error/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('navigate between login and register modes', async ({ page }) => {
    await page.goto('/');
    const auth = new AuthPage(page);

    await auth.openLoginModal();

    // Should start in login mode
    await expect(page.getByText('Welcome Back')).toBeVisible();

    // Switch to register
    await auth.switchToRegister();
    await expect(page.getByText('Create Account')).toBeVisible();

    // Switch back to login
    await auth.switchToLogin();
    await expect(page.getByText('Welcome Back')).toBeVisible();
  });
});
