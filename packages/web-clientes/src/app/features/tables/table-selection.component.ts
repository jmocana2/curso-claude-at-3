import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { CartStore } from '../../core/store/cart.store'
import { RestaurantService } from '../../core/services/restaurant.service'
import { TableService } from '../../core/services/table.service'
import { Restaurant } from '../../core/models/restaurant.model'
import { Table } from '../../core/models/table.model'

@Component({
  selector: 'app-table-selection',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container">
      <div class="page-header">
        <h1>Elige tu mesa</h1>
        @if (restaurant()) {
          <p>{{ restaurant()!.name }}</p>
        }
      </div>

      <form class="card people-form" (ngSubmit)="search()">
        <div class="form-group">
          <label for="people">Número de personas</label>
          <input
            id="people"
            name="people"
            type="number"
            min="1"
            step="1"
            inputmode="numeric"
            class="form-control"
            required
            [attr.aria-invalid]="peopleError() ? 'true' : null"
            [attr.aria-describedby]="peopleError() ? 'people-error' : null"
            [ngModel]="people()"
            (ngModelChange)="people.set($event)"
          />
          @if (peopleError()) {
            <p id="people-error" class="field-error" role="alert">{{ peopleError() }}</p>
          }
        </div>
        <button type="submit" class="btn btn-primary" [disabled]="loading()">
          {{ loading() ? 'Buscando...' : 'Buscar mesas' }}
        </button>
      </form>

      <div aria-live="polite">
        @if (message()) {
          <div class="alert-error" role="alert">{{ message() }}</div>
        }
      </div>

      @if (searched() && !loading()) {
        @if (tables().length === 0) {
          <div class="empty-state card">
            <p>No hay mesas disponibles para {{ searchedPeople() }} {{ searchedPeople() === 1 ? 'persona' : 'personas' }}</p>
          </div>
        } @else {
          <fieldset class="card tables-fieldset">
            <legend>Mesas disponibles para {{ searchedPeople() }} {{ searchedPeople() === 1 ? 'persona' : 'personas' }}</legend>
            @for (table of tables(); track table.id) {
              <label class="table-option" [class.selected]="selectedId() === table.id">
                <input
                  type="radio"
                  name="table"
                  [value]="table.id"
                  [checked]="selectedId() === table.id"
                  (change)="selectedId.set(table.id)"
                />
                <span class="table-name">Mesa {{ table.number }}</span>
                <span class="table-detail">
                  {{ table.capacity }} {{ table.capacity === 1 ? 'persona' : 'personas' }}@if (table.description) { · {{ table.description }}}
                </span>
              </label>
            }
          </fieldset>
        }
      }

      <div class="actions">
        <a routerLink="/restaurants" class="btn btn-secondary">Volver</a>
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="!selectedId() || occupying()"
          (click)="continue()"
        >
          {{ occupying() ? 'Reservando mesa...' : 'Continuar' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 700px;
      margin: 0 auto;
    }
    .people-form {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 16px;
    }
    .people-form .form-group {
      flex: 1;
      margin-bottom: 0;
    }
    .field-error {
      color: var(--red);
      font-size: 13px;
      margin-top: 4px;
    }
    .alert-error {
      margin-bottom: 16px;
    }
    .tables-fieldset {
      margin: 0 0 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .tables-fieldset legend {
      font-weight: 600;
      padding: 0 8px;
    }
    .table-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      cursor: pointer;
    }
    .table-option:hover,
    .table-option:focus-within {
      background: var(--bg-hover);
    }
    .table-option.selected {
      border-color: var(--green-light);
    }
    .table-name {
      font-weight: 600;
    }
    .table-detail {
      color: var(--text-muted);
      font-size: 13px;
    }
    .actions {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    @media (max-width: 480px) {
      .people-form {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `]
})
export class TableSelectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly restaurantService = inject(RestaurantService)
  private readonly tableService = inject(TableService)
  private readonly cartStore = inject(CartStore)

  private restaurantId = ''

  readonly restaurant = signal<Restaurant | null>(null)
  readonly people = signal<number | null>(null)
  readonly peopleError = signal<string | null>(null)
  readonly searchedPeople = signal<number | null>(null)
  readonly searched = signal(false)
  readonly tables = signal<Table[]>([])
  readonly selectedId = signal<string | null>(null)
  readonly loading = signal(false)
  readonly occupying = signal(false)
  readonly message = signal<string | null>(null)

  ngOnInit(): void {
    this.restaurantId = this.route.snapshot.paramMap.get('id')!
    this.restaurantService.getById(this.restaurantId).subscribe({
      next: (restaurant) => this.restaurant.set(restaurant),
      error: () => {}
    })
  }

  /**
   * Busca las mesas libres con capacidad suficiente para el número de personas indicado.
   */
  search(): void {
    const people = Number(this.people())
    if (!Number.isInteger(people) || people < 1) {
      this.peopleError.set('Indica un número de personas entero mayor que 0')
      return
    }
    this.peopleError.set(null)
    this.load(people)
  }

  /**
   * Ocupa la mesa elegida y navega a la carta; si ya no está libre, avisa y recarga el listado.
   */
  continue(): void {
    const tableId = this.selectedId()
    const table = this.tables().find(t => t.id === tableId)
    if (!table || this.occupying()) return

    this.occupying.set(true)
    this.message.set(null)
    this.tableService.occupy(this.restaurantId, table.id).subscribe({
      next: (occupied) => {
        this.cartStore.setTable({
          restaurantId: this.restaurantId,
          tableId: occupied.id,
          tableNumber: occupied.number
        })
        this.router.navigate(['/restaurants', this.restaurantId])
      },
      error: (err) => {
        this.occupying.set(false)
        if (err.status === 409) {
          this.message.set('Esa mesa ya no está disponible. Elige otra.')
          const people = this.searchedPeople()
          if (people) this.load(people, true)
        } else {
          this.message.set('No se ha podido ocupar la mesa. Inténtalo de nuevo.')
        }
      }
    })
  }

  private load(people: number, keepMessage = false): void {
    this.loading.set(true)
    this.selectedId.set(null)
    if (!keepMessage) this.message.set(null)
    this.tableService.getAvailable(this.restaurantId, people).subscribe({
      next: (tables) => {
        this.tables.set(tables)
        this.searchedPeople.set(people)
        this.searched.set(true)
        this.loading.set(false)
      },
      error: () => {
        this.message.set('Error al cargar las mesas disponibles')
        this.loading.set(false)
      }
    })
  }
}
