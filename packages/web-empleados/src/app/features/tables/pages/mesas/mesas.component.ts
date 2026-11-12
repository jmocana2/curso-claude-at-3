import { Component, inject, computed, OnInit, OnDestroy } from '@angular/core';
import { AuthStore } from '@resttek/web-shared';
import { TableStore } from '../../store/table.store';
import { Table, TableStatus } from '../../models/table.model';
import { OrderStore } from '../../../orders/store/order.store';
import { Order } from '../../../orders/models/order.model';

/** Estados de mesa disponibles en el selector, con su etiqueta en español. */
const STATUS_OPTIONS: { value: TableStatus; label: string }[] = [
  { value: 'libre', label: 'Libre' },
  { value: 'ocupada', label: 'Ocupada' },
  { value: 'reservada', label: 'Reservada' },
];

@Component({
  selector: 'app-mesas',
  standalone: true,
  templateUrl: './mesas.component.html',
  styleUrl: './mesas.component.css'
})
export class MesasComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);

  readonly orderStore = inject(OrderStore);

  readonly statusOptions = STATUS_OPTIONS;

  /** Pedidos activos agrupados por id de mesa. */
  readonly ordersByTable = computed(() => {
    const map = new Map<string, Order[]>();
    for (const order of this.orderStore.orders()) {
      if (!order.tableId) continue;
      map.set(order.tableId, [...(map.get(order.tableId) ?? []), order]);
    }
    return map;
  });

  private get restaurantId(): string | undefined {
    return this.authStore.user()?.restaurantId;
  }

  ngOnInit(): void {
    const restaurantId = this.restaurantId;
    if (restaurantId) {
      this.tableStore.startPolling(restaurantId);
      this.orderStore.startPolling(restaurantId);
    }
  }

  ngOnDestroy(): void {
    this.tableStore.stopPolling();
    this.orderStore.stopPolling();
  }

  onStatusChange(table: Table, event: Event): void {
    const restaurantId = this.restaurantId;
    if (!restaurantId) return;
    const status = (event.target as HTMLSelectElement).value as TableStatus;
    this.tableStore.changeStatus(restaurantId, table.id, status);
  }

  ordersOf(table: Table): Order[] {
    return this.ordersByTable().get(table.id) ?? [];
  }

  getStatusClass(status: string): string {
    return `badge badge-${status}`;
  }
}
