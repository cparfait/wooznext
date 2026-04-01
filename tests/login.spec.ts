import { test, expect } from '@playwright/test';

test.describe('Connexion agent', () => {
  test('connexion valide redirige vers le dashboard', async ({ page }) => {
    await page.goto('/agent/login');
    await page.locator('#email').fill('agent1@wooz.next');
    await page.locator('#password').fill('agent');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // Attend la redirection (counter selection ou /agent directement)
    await page.waitForURL(/\/agent$/, { timeout: 15_000 });
    await expect(page).toHaveURL('/agent');
  });

  test('connexion admin redirige vers le dashboard', async ({ page }) => {
    await page.goto('/agent/login');
    await page.locator('#email').fill('admin@wooz.next');
    await page.locator('#password').fill('admin');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await page.waitForURL(/\/agent$/, { timeout: 15_000 });
    await expect(page).toHaveURL('/agent');
  });

  test('identifiants invalides affichent un message d\'erreur', async ({ page }) => {
    await page.goto('/agent/login');
    await page.locator('#email').fill('inconnu@wooz.next');
    await page.locator('#password').fill('mauvais');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(
      page.getByText('Email ou mot de passe incorrect')
    ).toBeVisible();
    await expect(page).toHaveURL('/agent/login');
  });

  test('un utilisateur déjà connecté voit le dashboard', async ({ page }) => {
    // Connexion
    await page.goto('/agent/login');
    await page.locator('#email').fill('agent1@wooz.next');
    await page.locator('#password').fill('agent');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.waitForURL(/\/agent$/);

    // Navigation directe vers /agent doit fonctionner (middleware valide la session)
    await page.goto('/agent');
    await expect(page).toHaveURL('/agent');
  });
});
