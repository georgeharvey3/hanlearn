import { Page, Locator, expect } from '@playwright/test';

export class AuthPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly signUpButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[placeholder="Email"]');
    this.passwordInput = page.locator('input[placeholder="Password"]');
    this.loginButton = page.getByRole('button', { name: 'Log In', exact: true });
    this.signUpButton = page.getByRole('button', { name: 'Sign Up', exact: true });
  }

  async openLoginModal(): Promise<void> {
    const trigger = this.page.getByRole('button', { name: /log in|sign up/i }).first();
    await trigger.click();
    await this.emailInput.waitFor({ state: 'visible' });
  }

  async switchToRegister(): Promise<void> {
    await this.page.getByText('Sign Up', { exact: false }).filter({ hasText: /sign up/i }).last().click();
    await expect(this.page.getByText('Create Account')).toBeVisible();
  }

  async switchToLogin(): Promise<void> {
    await this.page.getByText('Log In', { exact: false }).filter({ hasText: /log in/i }).last().click();
    await expect(this.page.getByText('Welcome Back')).toBeVisible();
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async submitLogin(): Promise<void> {
    await this.loginButton.click();
  }

  async submitRegister(): Promise<void> {
    await this.signUpButton.click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submitLogin();
  }

  async register(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submitRegister();
  }

  async logout(): Promise<void> {
    // Click logout in sidebar or drawer
    await this.page.getByRole('button', { name: /logout/i }).click();
  }

  async expectLoggedIn(): Promise<void> {
    await expect(
      this.page.getByText(/Dashboard|Add Words/i).first(),
    ).toBeVisible({ timeout: 10000 });
  }

  async expectLoggedOut(): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: /log in|sign up/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  }

  async getErrorMessage(): Promise<string> {
    const error = this.page.locator('[class*="MuiTypography"][class*="colorError"], [style*="color: rgb(211, 47, 47)"]').first();
    await error.waitFor({ state: 'visible', timeout: 5000 });
    return (await error.textContent()) || '';
  }
}
