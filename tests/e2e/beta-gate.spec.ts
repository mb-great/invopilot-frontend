import { test, expect } from '@playwright/test';

/**
 * Beta Gate Flow Tests
 * 
 * Tests the mandatory beta application gate:
 * 1. Unauthenticated users → /login
 * 2. /beta/apply page renders correctly (public route)
 * 3. /beta/apply form has all required fields
 * 4. Form validation works
 */

test.describe('Beta Gate — Public Route Tests', () => {
  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated /invoices/new redirects to /login', async ({ page }) => {
    await page.goto('/invoices/new', { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/login');
  });

  test('/beta/apply is accessible without auth (public route)', async ({ page }) => {
    const response = await page.goto('/beta/apply', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain('/beta/apply');
  });

  test('/beta/apply renders the full application form', async ({ page }) => {
    await page.goto('/beta/apply', { waitUntil: 'networkidle' });

    // Heading
    await expect(page.getByText('Join the InvoPilot Beta')).toBeVisible();

    // Name field
    await expect(page.getByPlaceholder('Your name')).toBeVisible();

    // Email field
    await expect(page.getByPlaceholder('you@business.com')).toBeVisible();

    // Business type dropdown — verify key options exist
    await expect(page.getByText('Freelancer / Consultant')).toBeAttached();
    await expect(page.getByText('Agency')).toBeAttached();
    await expect(page.getByText('Small business / MSME')).toBeAttached();

    // Monthly invoices dropdown — use exact match to avoid '21 - 50' collision
    await expect(page.getByText('1 - 5', { exact: true })).toBeAttached();
    await expect(page.getByText('50+', { exact: true })).toBeAttached();

    // Optional problem field
    await expect(page.getByPlaceholder('Optional')).toBeVisible();

    // Review checkbox
    await expect(page.getByText('The beta deal:')).toBeVisible();
    await expect(page.locator('input[type="checkbox"]')).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: 'Apply for Beta Access' })).toBeVisible();

    // Footer text
    await expect(page.getByText('No credit card. No spam.')).toBeVisible();
  });

  test('/beta/apply form validation — rejects empty required fields', async ({ page }) => {
    await page.goto('/beta/apply', { waitUntil: 'networkidle' });

    // Wait for React hydration
    await expect(page.getByRole('button', { name: 'Apply for Beta Access' })).toBeVisible();

    // Click submit without filling anything
    await page.getByRole('button', { name: 'Apply for Beta Access' }).click();

    // Should show validation error
    await expect(page.getByText('Please fill all required fields')).toBeVisible({ timeout: 3000 });
  });

  test('/beta/apply form validation — rejects unchecked review agreement', async ({ page }) => {
    await page.goto('/beta/apply', { waitUntil: 'networkidle' });

    // Wait for React hydration
    await expect(page.getByRole('button', { name: 'Apply for Beta Access' })).toBeVisible();

    // Fill all fields except checkbox
    await page.getByPlaceholder('Your name').fill('Test User');
    await page.getByPlaceholder('you@business.com').fill('test@example.com');

    // Select dropdowns
    const selects = page.locator('select');
    await selects.nth(0).selectOption('Freelancer / Consultant');
    await selects.nth(1).selectOption('1 - 5');

    // Don't check the checkbox — click submit
    await page.getByRole('button', { name: 'Apply for Beta Access' }).click();

    // Should show checkbox-specific error
    await expect(page.getByText('agree to the review commitment')).toBeVisible({ timeout: 3000 });
  });

  test('/login page loads without errors', async ({ page }) => {
    const response = await page.goto('/login', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain('/login');
  });

  test('/signup page loads without errors', async ({ page }) => {
    const response = await page.goto('/signup', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
  });

  test('public tool pages are accessible', async ({ page }) => {
    const response = await page.goto('/tools/msme-interest-calculator', { waitUntil: 'networkidle' });
    expect(page.url()).not.toContain('/login');
    expect(page.url()).not.toContain('/beta/apply');
  });
});
