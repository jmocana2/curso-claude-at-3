import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChangeTableStatusDto, Table } from '../models/table.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly http = inject(HttpClient);

  private url(restaurantId: string): string {
    return `${environment.apiUrl}/restaurants/${restaurantId}/tables`;
  }

  getAll(restaurantId: string): Observable<Table[]> {
    return this.http.get<Table[]>(this.url(restaurantId));
  }

  changeStatus(restaurantId: string, tableId: string, dto: ChangeTableStatusDto): Observable<Table> {
    return this.http.patch<Table>(`${this.url(restaurantId)}/${tableId}/status`, dto);
  }
}
