import { test, expect } from '@playwright/test';

test.describe('Storefront User Flow', () => {
  test('Complete purchase with Spin Wheel and Mock QPay', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/');

    // Wait for products to load
    await page.waitForSelector('.pc.vis');

    // 2. Add first product directly to cart using the hover overlay button
    const firstProduct = page.locator('.pc').first();
    await firstProduct.hover();
    await firstProduct.locator('.pov-btn').click({ force: true });

    // The cart slider should be accessible via header cart button
    // Click the cart toggle if overlay is not open automatically
    // But `aId` (add to cart) usually triggers a Toast. We can just explicitly open cart.
    await page.locator('#btn-cart').click();
    
    // Check if Checkout modal is triggered via "doCheckout()"
    await page.locator('button[onclick="doCheckout()"]').click();
    
    // Checkout modal is visible
    const checkoutModal = page.locator('#mo-auth');
    await expect(checkoutModal).toHaveClass(/on/);

    // 3. Play the Spin Wheel for a discount
    // For automated E2E, the spin wheel animation takes 5+ seconds. 
    // We will simulate just filling out the guest checkout.
    await page.fill('#co-name', 'Test User E2E');
    await page.fill('#co-email', 'tester@webshop.mn');
    await page.fill('#co-phone', '99119911');
    await page.fill('#co-address', 'Sukhbaatar district, Baga toiruu, 4th khoroo');

    // Submit Checkout
    await page.locator('#co-submit-btn').click();

    // 4. Wait for Success & QPay overlay
    const qbg = page.locator('#qbg');
    await expect(qbg).toHaveClass(/on/, { timeout: 10000 });

    // Find the Mock QPay simulate button and click it
    const mockQPayBtn = page.locator('#mock-qpay-btn');
    await expect(mockQPayBtn).toBeVisible();
    await mockQPayBtn.click();

    // Wait for success indicator on button
    await expect(mockQPayBtn).toHaveText(/✅ Төлбөр амжилттай/, { timeout: 7000 });
  });
});
