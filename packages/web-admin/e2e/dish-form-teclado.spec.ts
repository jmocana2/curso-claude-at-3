import { test, expect, type Locator, type Page } from '@playwright/test'

const EMAIL_ADMIN = 'admin@resttek.com'
const URL_NUEVO_PLATO = '/restaurants/rest-1/dishes/new'

/** Pulsa Tab (o Shift+Tab) hasta que el foco llegue al elemento indicado. */
async function tabular_hasta(page: Page, destino: Locator, { atras = false, max = 40 } = {}): Promise<void> {
  const tecla = atras ? 'Shift+Tab' : 'Tab'
  for (let i = 0; i < max; i++) {
    if (await destino.evaluate(el => el === document.activeElement).catch(() => false)) return
    await page.keyboard.press(tecla)
  }
  await expect(destino).toBeFocused()
}

async function iniciar_sesion_con_teclado(page: Page): Promise<void> {
  await page.goto('/login')
  await tabular_hasta(page, page.getByLabel('Correo electrónico'))
  await page.keyboard.type(EMAIL_ADMIN)
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Contraseña')).toBeFocused()
  await page.keyboard.type(EMAIL_ADMIN)
  await page.keyboard.press('Enter')
  await page.waitForURL(url => !url.pathname.startsWith('/login'))
}

test('el formulario de platos se completa solo con el teclado', async ({ page }) => {
  await iniciar_sesion_con_teclado(page)

  await page.goto(URL_NUEVO_PLATO)
  await expect(page.getByRole('heading', { level: 1, name: 'Nuevo plato' })).toBeVisible()

  const nombre = page.getByLabel('Nombre del plato')
  await tabular_hasta(page, nombre)
  await expect(nombre).toBeFocused()

  // El elemento anterior al nombre es el enlace de volver, con nombre accesible
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('link', { name: 'Volver a la lista de platos' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(nombre).toBeFocused()
})
