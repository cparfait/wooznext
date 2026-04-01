import { test, expect } from '@playwright/test';

test.describe('Parcours visiteur — prise de ticket', () => {
  let serviceId: string;

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/services');
    const data = await res.json();
    // Utilise le premier service disponible (seed: SUPPORT)
    serviceId = data.services[0].id;
  });

  test('affiche une erreur si aucun service dans l\'URL', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByText('Aucun service specifie. Veuillez scanner le QR code du service.')
    ).toBeVisible();
  });

  test('affiche le formulaire pour un service valide', async ({ page }) => {
    await page.goto(`/?service=${serviceId}`);
    await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible();
    await expect(page.locator('#phone')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prendre un ticket' })).toBeVisible();
  });

  test('prend un ticket et redirige vers la page de suivi', async ({ page }) => {
    // Numéro unique pour éviter le retour du ticket existant (anti-doublon)
    const phone = `06${Date.now().toString().slice(-8)}`;

    await page.goto(`/?service=${serviceId}`);
    await expect(page.locator('#phone')).toBeVisible();

    await page.locator('#phone').fill(phone);
    await page.getByRole('button', { name: 'Prendre un ticket' }).click();

    // Doit rediriger vers /ticket/<id>
    await page.waitForURL(/\/ticket\/.+/, { timeout: 10_000 });

    // La page de suivi affiche le numéro du ticket
    await expect(page.getByText('Votre ticket')).toBeVisible();
  });

  test('retrouve le même ticket si le numéro est déjà en file', async ({ page }) => {
    const phone = `07${Date.now().toString().slice(-8)}`;

    // Première prise
    await page.goto(`/?service=${serviceId}`);
    await page.locator('#phone').fill(phone);
    await page.getByRole('button', { name: 'Prendre un ticket' }).click();
    await page.waitForURL(/\/ticket\/.+/);
    const firstUrl = page.url();

    // Deuxième tentative avec le même numéro
    await page.goto(`/?service=${serviceId}`);
    await page.locator('#phone').fill(phone);
    await page.getByRole('button', { name: 'Prendre un ticket' }).click();
    await page.waitForURL(/\/ticket\/.+/);

    // Doit retourner le même ticket (même URL)
    expect(page.url()).toBe(firstUrl);
  });
});
