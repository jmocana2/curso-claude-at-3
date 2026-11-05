import { test, expect, type Locator, type Page } from '@playwright/test'

const EMAIL_ADMIN = 'admin@resttek.com'
const URL_NUEVO_PLATO = '/restaurants/rest-1/dishes/new'

/** Pulsa Tab (o Shift+Tab) hasta que el foco llegue al elemento indicado. */
async function tabular_hasta(page: Page, destino: Locator, { atras = false, max = 40 } = {}): Promise<void> {
  const tecla = atras ? 'Shift+Tab' : 'Tab'
  for (let i = 0; i < max; i++) {
    const existe = (await destino.count()) === 1
    if (existe && (await destino.evaluate(el => el === document.activeElement))) return
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

  // La sección de ingredientes es un grupo con nombre
  const ingredientes = page.getByRole('group', { name: 'Ingredientes del plato' })
  await expect(ingredientes).toBeVisible()

  // Añadir un ingrediente solo con teclado
  const selector_ingrediente = page.getByLabel('Ingrediente a añadir')
  const cantidad = page.getByLabel('Cantidad del ingrediente')
  const boton_anadir = page.getByRole('button', { name: 'Añadir ingrediente' })
  await tabular_hasta(page, selector_ingrediente)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Tab')
  await expect(cantidad).toBeFocused()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('2')
  await page.keyboard.press('Tab')
  await expect(boton_anadir).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(ingredientes.getByRole('listitem')).toHaveCount(1)

  // Quitar el ingrediente solo con teclado; el botón mide al menos 24x24 px (WCAG 2.5.8)
  const boton_quitar = ingredientes.getByRole('button', { name: /^Quitar / })
  await tabular_hasta(page, boton_quitar, { atras: true })
  const caja = await boton_quitar.boundingBox()
  expect(caja?.width).toBeGreaterThanOrEqual(24)
  expect(caja?.height).toBeGreaterThanOrEqual(24)
  await page.keyboard.press('Enter')
  await expect(ingredientes.getByRole('listitem')).toHaveCount(0)
})
