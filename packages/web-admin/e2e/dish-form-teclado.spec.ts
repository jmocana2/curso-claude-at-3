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

/** Comprueba que el elemento enfocado muestra un contorno de foco visible de al menos 2px. */
async function esperar_foco_visible(destino: Locator): Promise<void> {
  await expect(destino).toBeFocused()
  const contorno = await destino.evaluate(el => {
    const estilo = getComputedStyle(el)
    return { estilo: estilo.outlineStyle, ancho: parseFloat(estilo.outlineWidth) }
  })
  expect(contorno.estilo).not.toBe('none')
  expect(contorno.ancho).toBeGreaterThanOrEqual(2)
}

/**
 * Con el foco en el selector de ingredientes, elige la opción en la posición
 * indicada con las flechas, escribe la cantidad y pulsa "Añadir ingrediente".
 */
async function anadir_ingrediente(page: Page, { posicion, cantidad }: { posicion: number; cantidad: string }): Promise<void> {
  await expect(page.getByLabel('Ingrediente a añadir')).toBeFocused()
  for (let i = 0; i < posicion; i++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Cantidad del ingrediente')).toBeFocused()
  await page.keyboard.press('Control+A')
  await page.keyboard.type(cantidad)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Añadir ingrediente' })).toBeFocused()
  await page.keyboard.press('Enter')
}

/** Pausa breve para que el vídeo se pueda seguir. */
async function pausa(page: Page, ms = 700): Promise<void> {
  await page.waitForTimeout(ms)
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

test('estructura, foco y validación del formulario con teclado', async ({ page }) => {
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

  // Añadir dos ingredientes solo con teclado; tras añadir, el foco vuelve al selector
  const selector_ingrediente = page.getByLabel('Ingrediente a añadir')
  const cantidad = page.getByLabel('Cantidad del ingrediente')
  const boton_anadir = page.getByRole('button', { name: 'Añadir ingrediente' })
  const chips = ingredientes.getByRole('listitem')
  await tabular_hasta(page, selector_ingrediente)
  await anadir_ingrediente(page, { posicion: 1, cantidad: '2' })
  await expect(chips).toHaveCount(1)
  await expect(selector_ingrediente).toBeFocused()
  // El cambio se anuncia en una región viva (role="status" equivale a aria-live="polite")
  const anuncio = page.getByRole('status')
  await expect(anuncio).toHaveText(/añadido/)
  await anadir_ingrediente(page, { posicion: 2, cantidad: '3' })
  await expect(chips).toHaveCount(2)
  await expect(selector_ingrediente).toBeFocused()

  // Quitar ingredientes solo con teclado; el botón mide al menos 24x24 px (WCAG 2.5.8)
  const botones_quitar = ingredientes.getByRole('button', { name: /^Quitar / })
  await tabular_hasta(page, botones_quitar.first(), { atras: true })
  const caja = await botones_quitar.first().boundingBox()
  expect(caja?.width).toBeGreaterThanOrEqual(24)
  expect(caja?.height).toBeGreaterThanOrEqual(24)
  await page.keyboard.press('Enter')
  await expect(chips).toHaveCount(1)
  await expect(anuncio).toHaveText(/quitado/)
  // El foco pasa al siguiente botón "Quitar"
  await expect(botones_quitar.first()).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(chips).toHaveCount(0)
  // Sin ingredientes, el foco vuelve al selector
  await expect(selector_ingrediente).toBeFocused()

  // Añadir sin elegir ingrediente muestra un aviso asociado al selector
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(boton_anadir).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(selector_ingrediente).toBeFocused()
  await expect(selector_ingrediente).toHaveAttribute('aria-invalid', 'true')
  await expect(selector_ingrediente).toHaveAccessibleDescription('Selecciona un ingrediente.')

  // Añadir con cantidad 0 muestra un aviso asociado a la cantidad
  await anadir_ingrediente(page, { posicion: 1, cantidad: '0' })
  await expect(chips).toHaveCount(0)
  await expect(cantidad).toBeFocused()
  await expect(cantidad).toHaveAttribute('aria-invalid', 'true')
  await expect(cantidad).toHaveAccessibleDescription('La cantidad debe ser mayor que 0.')
  await expect(selector_ingrediente).not.toHaveAttribute('aria-invalid', 'true')

  // Tras "Añadir ingrediente" vienen "Cancelar" (enlace) y "Guardar" (envío del formulario)
  await tabular_hasta(page, boton_anadir)
  await esperar_foco_visible(boton_anadir)
  await page.keyboard.press('Tab')
  await esperar_foco_visible(page.getByRole('link', { name: 'Cancelar' }))
  await page.keyboard.press('Tab')
  const boton_guardar = page.getByRole('button', { name: 'Guardar' })
  await esperar_foco_visible(boton_guardar)
  await expect(boton_guardar).toHaveAttribute('type', 'submit')

  // Enviar el formulario vacío no llama a la API
  const envios_a_la_api: string[] = []
  page.on('request', peticion => {
    if (peticion.method() === 'POST' && peticion.url().includes('/dishes')) envios_a_la_api.push(peticion.url())
  })
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`${URL_NUEVO_PLATO}$`))
  await page.waitForTimeout(500)
  expect(envios_a_la_api).toHaveLength(0)

  // Los errores se anuncian, se asocian a cada campo y el foco va al primero inválido
  await expect(page.getByRole('alert')).toContainText('2 errores')
  await expect(nombre).toBeFocused()
  await expect(nombre).toHaveAttribute('aria-invalid', 'true')
  await expect(nombre).toHaveAccessibleDescription('El nombre del plato es obligatorio.')
  const precio = page.getByLabel('Precio (€)')
  await expect(precio).toHaveAttribute('aria-invalid', 'true')
  await expect(precio).toHaveAccessibleDescription('El precio debe ser mayor que 0.')
})

test('un error de la API se anuncia y recibe el foco', async ({ page }) => {
  await page.route('**/api/v1/restaurants/*/dishes', ruta =>
    ruta.request().method() === 'POST'
      ? ruta.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Error simulado del servidor' }) })
      : ruta.continue()
  )
  await iniciar_sesion_con_teclado(page)
  await page.goto(URL_NUEVO_PLATO)

  await tabular_hasta(page, page.getByLabel('Nombre del plato'))
  await page.keyboard.type('Plato con error')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Control+A')
  await page.keyboard.type('5')
  await page.keyboard.press('Enter')

  const alerta = page.getByRole('alert')
  await expect(alerta).toHaveText('Error simulado del servidor')
  await expect(alerta).toBeFocused()
})

test('vídeo: recorrido completo del formulario de platos solo con teclado', async ({ page }) => {
  const nombre_plato = `Ensalada de la huerta ${Date.now()}`
  await iniciar_sesion_con_teclado(page)
  await page.goto(URL_NUEVO_PLATO)
  await expect(page.getByRole('heading', { level: 1, name: 'Nuevo plato' })).toBeVisible()
  await pausa(page)

  // 1. Rellenar y modificar datos
  const nombre = page.getByLabel('Nombre del plato')
  const precio = page.getByLabel('Precio (€)')
  const categoria = page.getByLabel('Categoría')
  const disponible = page.getByLabel('Disponible')
  const descripcion = page.getByLabel('Descripción (opcional)')
  await tabular_hasta(page, nombre)
  await page.keyboard.type('Ensalada', { delay: 60 })
  await pausa(page)
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.type(nombre_plato, { delay: 40 })
  await page.keyboard.press('Tab')
  await expect(precio).toBeFocused()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('9.5', { delay: 60 })
  await page.keyboard.press('Tab')
  await expect(categoria).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await pausa(page, 400)
  await page.keyboard.press('Tab')
  await expect(disponible).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await pausa(page, 400)
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Tab')
  await expect(descripcion).toBeFocused()
  await page.keyboard.type('Lechuga, tomate y aceite de oliva.', { delay: 30 })
  await pausa(page)

  await expect(nombre).toHaveValue(nombre_plato)
  await expect(precio).toHaveValue('9.5')
  await expect(categoria.locator('option:checked')).toHaveText('Entrante')
  await expect(disponible.locator('option:checked')).toHaveText('Sí')
  await expect(descripcion).toHaveValue('Lechuga, tomate y aceite de oliva.')
})
