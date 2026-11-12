import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Table, TableStatus } from '../models/table.model';
import { TableService } from '../services/table.service';

@Injectable({ providedIn: 'root' })
export class TableStore {
  private readonly tableService = inject(TableService);

  private readonly _tables = signal<Table[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  readonly tables = this._tables.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  async loadTables(restaurantId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const tables = await firstValueFrom(this.tableService.getAll(restaurantId));
      this._tables.set(tables);
    } catch (err: any) {
      this._error.set(err.message || 'Error al cargar mesas');
    } finally {
      this._loading.set(false);
    }
  }

  async changeStatus(restaurantId: string, tableId: string, status: TableStatus): Promise<void> {
    this._error.set(null);
    try {
      const updated = await firstValueFrom(this.tableService.changeStatus(restaurantId, tableId, { status }));
      this._tables.update(tables => tables.map(table => (table.id === tableId ? updated : table)));
    } catch (err: any) {
      this._error.set(err.message || 'Error al cambiar el estado de la mesa');
    }
  }

  startPolling(restaurantId: string): void {
    this.stopPolling();
    this.loadTables(restaurantId);
    this.pollingInterval = setInterval(() => {
      this.loadTables(restaurantId);
    }, 30000);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}
