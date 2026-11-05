import { afterNextRender, Component, computed, ElementRef, inject, Injector, OnInit, signal, viewChild, viewChildren } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { firstValueFrom } from 'rxjs'
import { DishStore } from '../../store/dish.store'
import { DishService } from '../../services/dish.service'
import { IngredientStore } from '../../../ingredients/store/ingredient.store'
import type { CreateDishDto, DishCategory } from '../../models/dish.model'

export interface ErroresPlato {
  name?: string
  price?: string
}

@Component({
  selector: 'app-dish-form',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './dish-form.component.html',
  styleUrl: './dish-form.component.css'
})
export class DishFormComponent implements OnInit {
  private readonly store = inject(DishStore)
  private readonly service = inject(DishService)
  readonly ingredientStore = inject(IngredientStore)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly injector = inject(Injector)

  private readonly selectorIngrediente = viewChild.required<ElementRef<HTMLSelectElement>>('selectorIngrediente')
  private readonly botonesQuitar = viewChildren<ElementRef<HTMLButtonElement>>('botonQuitar')
  private readonly campoCantidad = viewChild.required<ElementRef<HTMLInputElement>>('campoCantidad')
  private readonly campoNombre = viewChild.required<ElementRef<HTMLInputElement>>('campoNombre')
  private readonly campoPrecio = viewChild.required<ElementRef<HTMLInputElement>>('campoPrecio')

  isEditing = false
  dishId: string | null = null
  restaurantId: string = ''
  loading = signal(false)
  error = signal<string | null>(null)
  /** Texto que se anuncia a los lectores de pantalla al añadir o quitar ingredientes. */
  anuncio = signal('')
  /** Errores de validación del formulario, por campo. */
  errores = signal<ErroresPlato>({})
  /** Mensajes de error en el orden de los campos, para el resumen. */
  mensajesError = computed(() => [this.errores().name, this.errores().price].filter((m): m is string => !!m))
  /** Aviso del bloque de añadir ingrediente, asociado al campo que lo provoca. */
  errorIngrediente = signal<{ campo: 'ingrediente' | 'cantidad'; mensaje: string } | null>(null)

  categories: DishCategory[] = ['entrante', 'principal', 'postre', 'bebida']

  form: CreateDishDto = {
    name: '',
    description: null,
    price: 0,
    category: 'principal',
    available: true,
    ingredients: []
  }

  newIngredientId = ''
  newIngredientQty = 1

  get pageTitle(): string {
    return this.isEditing ? 'Editar plato' : 'Nuevo plato'
  }

  get listUrl(): string {
    return `/restaurants/${this.restaurantId}/dishes`
  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      'entrante': 'Entrante',
      'principal': 'Principal',
      'postre': 'Postre',
      'bebida': 'Bebida'
    }
    return labels[category] ?? category
  }

  ngOnInit(): void {
    this.restaurantId = this.route.parent?.snapshot.params['restaurantId'] ?? ''
    const id = this.route.snapshot.paramMap.get('id')

    if (this.restaurantId) {
      this.ingredientStore.loadByRestaurant(this.restaurantId)
    }

    if (id && this.restaurantId) {
      this.isEditing = true
      this.dishId = id
      this.loadDish()
    }
  }

  private async loadDish(): Promise<void> {
    this.loading.set(true)
    try {
      const dish = await firstValueFrom(this.service.getById(this.restaurantId, this.dishId!))
      this.form = {
        name: dish.name,
        description: dish.description,
        price: dish.price,
        category: dish.category,
        available: dish.available,
        ingredients: [...dish.ingredients]
      }
    } catch {
      this.error.set('No se pudo cargar el plato.')
    } finally {
      this.loading.set(false)
    }
  }

  addIngredient(): void {
    if (!this.newIngredientId) {
      this.mostrarErrorIngrediente('ingrediente', 'Selecciona un ingrediente.')
      return
    }
    if (this.form.ingredients.some(i => i.ingredientId === this.newIngredientId)) {
      this.mostrarErrorIngrediente('ingrediente', 'Ese ingrediente ya está en el plato.')
      return
    }
    if (!(this.newIngredientQty > 0)) {
      this.mostrarErrorIngrediente('cantidad', 'La cantidad debe ser mayor que 0.')
      return
    }
    this.errorIngrediente.set(null)

    this.form.ingredients = [
      ...this.form.ingredients,
      { ingredientId: this.newIngredientId, quantity: this.newIngredientQty }
    ]
    this.anuncio.set(`Ingrediente ${this.getIngredientName(this.newIngredientId)} añadido.`)
    this.newIngredientId = ''
    this.newIngredientQty = 1
    this.enfocarTrasRender(() => this.selectorIngrediente().nativeElement)
  }

  removeIngredient(ingredientId: string): void {
    const indice = this.form.ingredients.findIndex(i => i.ingredientId === ingredientId)
    this.form.ingredients = this.form.ingredients.filter(i => i.ingredientId !== ingredientId)
    this.anuncio.set(`Ingrediente ${this.getIngredientName(ingredientId)} quitado.`)
    // El foco pasa al siguiente botón "Quitar", al anterior si era el último, o al selector si no quedan
    this.enfocarTrasRender(() => {
      const botones = this.botonesQuitar()
      const boton = botones[indice] ?? botones[indice - 1]
      return boton?.nativeElement ?? this.selectorIngrediente().nativeElement
    })
  }

  private mostrarErrorIngrediente(campo: 'ingrediente' | 'cantidad', mensaje: string): void {
    this.errorIngrediente.set({ campo, mensaje })
    const campoConError = campo === 'ingrediente' ? this.selectorIngrediente() : this.campoCantidad()
    this.enfocarTrasRender(() => campoConError.nativeElement)
  }

  /** Mueve el foco al elemento indicado cuando Angular haya actualizado la vista. */
  private enfocarTrasRender(obtenerElemento: () => HTMLElement): void {
    afterNextRender(() => obtenerElemento().focus(), { injector: this.injector })
  }

  getIngredientName(ingredientId: string): string {
    const ingredient = this.ingredientStore.ingredients().find(i => i.id === ingredientId)
    return ingredient ? `${ingredient.name} (${ingredient.unit})` : ingredientId
  }

  /** Valida el formulario, guarda los errores por campo y devuelve si es válido. */
  validar(): boolean {
    const errores: ErroresPlato = {}
    if (!this.form.name?.trim()) {
      errores.name = 'El nombre del plato es obligatorio.'
    }
    if (!(Number(this.form.price) > 0)) {
      errores.price = 'El precio debe ser mayor que 0.'
    }
    this.errores.set(errores)
    return Object.keys(errores).length === 0
  }

  async onSubmit(): Promise<void> {
    this.error.set(null)
    if (!this.validar()) {
      const primerCampoInvalido = this.errores().name ? this.campoNombre() : this.campoPrecio()
      this.enfocarTrasRender(() => primerCampoInvalido.nativeElement)
      return
    }
    this.loading.set(true)
    try {
      if (this.isEditing && this.dishId) {
        await this.store.update(this.restaurantId, this.dishId, this.form)
      } else {
        await this.store.create(this.restaurantId, this.form)
      }
      this.router.navigate(['/restaurants', this.restaurantId, 'dishes'])
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Error al guardar el plato.')
    } finally {
      this.loading.set(false)
    }
  }
}
