import { afterNextRender, Component, computed, ElementRef, inject, Injector, OnInit, signal, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { firstValueFrom } from 'rxjs'
import { TableStore } from '../../store/table.store'
import { TableService } from '../../services/table.service'

export interface ErroresMesa {
  number?: string
  capacity?: string
}

interface TableFormValue {
  number: number | null
  capacity: number | null
  description: string
}

/** Mensajes de campo para los errores de dominio que devuelve la API. */
const API_FIELD_ERRORS: Record<string, { campo: keyof ErroresMesa; mensaje: string }> = {
  DuplicatedTableNumberError: { campo: 'number', mensaje: 'Ya existe una mesa con ese número en este restaurante.' },
  InvalidTableNumberError: { campo: 'number', mensaje: 'El número de mesa debe ser un entero mayor que 0.' },
  InvalidTableCapacityError: { campo: 'capacity', mensaje: 'La capacidad debe ser un entero mayor que 0.' }
}

@Component({
  selector: 'app-table-form',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './table-form.component.html',
  styleUrl: './table-form.component.css'
})
export class TableFormComponent implements OnInit {
  private readonly store = inject(TableStore)
  private readonly service = inject(TableService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly injector = inject(Injector)

  private readonly campoNumero = viewChild.required<ElementRef<HTMLInputElement>>('campoNumero')
  private readonly campoCapacidad = viewChild.required<ElementRef<HTMLInputElement>>('campoCapacidad')
  private readonly alertaError = viewChild<ElementRef<HTMLDivElement>>('alertaError')

  isEditing = false
  tableId: string | null = null
  restaurantId = ''
  loading = signal(false)
  error = signal<string | null>(null)
  errores = signal<ErroresMesa>({})
  /** Mensajes de error en el orden de los campos, para el resumen. */
  mensajesError = computed(() => [this.errores().number, this.errores().capacity].filter((m): m is string => !!m))

  form: TableFormValue = {
    number: null,
    capacity: null,
    description: ''
  }

  get pageTitle(): string {
    return this.isEditing ? 'Editar mesa' : 'Nueva mesa'
  }

  get listUrl(): string {
    return `/restaurants/${this.restaurantId}/tables`
  }

  ngOnInit(): void {
    this.restaurantId = this.route.parent?.snapshot.params['restaurantId'] ?? ''
    const id = this.route.snapshot.paramMap.get('id')

    if (id && this.restaurantId) {
      this.isEditing = true
      this.tableId = id
      this.loadTable()
    }
  }

  private async loadTable(): Promise<void> {
    this.loading.set(true)
    try {
      const tables = await firstValueFrom(this.service.getAll(this.restaurantId))
      const found = tables.find(t => t.id === this.tableId)
      if (found) {
        this.form = {
          number: found.number,
          capacity: found.capacity,
          description: found.description ?? ''
        }
      } else {
        this.error.set('No se encontró la mesa.')
      }
    } catch {
      this.error.set('No se pudo cargar la mesa.')
    } finally {
      this.loading.set(false)
    }
  }

  private enfocarTrasRender(obtenerElemento: () => HTMLElement | undefined): void {
    afterNextRender(() => obtenerElemento()?.focus(), { injector: this.injector })
  }

  private esEnteroPositivo(valor: number | null): valor is number {
    return typeof valor === 'number' && Number.isInteger(valor) && valor > 0
  }

  /** Valida el formulario, guarda los errores por campo y devuelve si es válido. */
  private validar(): boolean {
    const errores: ErroresMesa = {}
    if (!this.esEnteroPositivo(this.form.number)) {
      errores.number = 'El número de mesa debe ser un entero mayor que 0.'
    }
    if (!this.esEnteroPositivo(this.form.capacity)) {
      errores.capacity = 'La capacidad debe ser un entero mayor que 0.'
    }
    this.errores.set(errores)
    return Object.keys(errores).length === 0
  }

  async onSubmit(): Promise<void> {
    this.error.set(null)
    if (!this.validar()) {
      const primerCampoInvalido = this.errores().number ? this.campoNumero() : this.campoCapacidad()
      this.enfocarTrasRender(() => primerCampoInvalido.nativeElement)
      return
    }
    const dto = {
      number: this.form.number as number,
      capacity: this.form.capacity as number,
      description: this.form.description.trim() || null
    }
    this.loading.set(true)
    try {
      if (this.isEditing && this.tableId) {
        await this.store.update(this.restaurantId, this.tableId, dto)
      } else {
        await this.store.create(this.restaurantId, dto)
      }
      this.router.navigate(['/restaurants', this.restaurantId, 'tables'])
    } catch (err: any) {
      const apiError = API_FIELD_ERRORS[err?.error?.error]
      if (apiError) {
        this.errores.set({ [apiError.campo]: apiError.mensaje })
        const campo = apiError.campo === 'number' ? this.campoNumero() : this.campoCapacidad()
        this.enfocarTrasRender(() => campo.nativeElement)
      } else {
        this.error.set(err?.error?.message ?? 'Error al guardar la mesa.')
        this.enfocarTrasRender(() => this.alertaError()?.nativeElement)
      }
    } finally {
      this.loading.set(false)
    }
  }
}
