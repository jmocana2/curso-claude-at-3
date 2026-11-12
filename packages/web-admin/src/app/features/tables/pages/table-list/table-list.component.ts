import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { TableStore } from '../../store/table.store'
import type { Table, TableStatus } from '../../models/table.model'

/** Etiqueta y clase de badge de cada estado de mesa. */
const STATUS_INFO: Record<TableStatus, { label: string; badge: string }> = {
  libre: { label: 'Libre', badge: '' },
  ocupada: { label: 'Ocupada', badge: 'badge-ocupada' },
  reservada: { label: 'Reservada', badge: 'badge-muted' }
}

@Component({
  selector: 'app-table-list',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './table-list.component.html',
  styleUrl: './table-list.component.css'
})
export class TableListComponent implements OnInit {
  readonly store = inject(TableStore)
  private readonly route = inject(ActivatedRoute)
  private readonly destroyRef = inject(DestroyRef)
  restaurantId = ''
  deleteError: string | null = null

  ngOnInit(): void {
    this.route.parent?.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.restaurantId = params.get('restaurantId') ?? ''
        if (this.restaurantId) {
          this.store.loadByRestaurant(this.restaurantId)
        }
      })
  }

  statusLabel(status: TableStatus): string {
    return STATUS_INFO[status].label
  }

  statusBadge(status: TableStatus): string {
    return STATUS_INFO[status].badge
  }

  async onDelete(table: Table): Promise<void> {
    if (!this.restaurantId) return
    this.deleteError = null
    if (confirm(`¿Estás seguro de eliminar la mesa ${table.number}?`)) {
      try {
        await this.store.delete(this.restaurantId, table.id)
      } catch {
        this.deleteError = `Error al eliminar la mesa ${table.number}.`
      }
    }
  }
}
