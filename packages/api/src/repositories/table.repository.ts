import { Database } from '@config/database.js'
import type { Table } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'

interface TableRow {
    id: string
    number: number
    description: string | null
    capacity: number
    status: string
    restaurantId: string
    createdAt: string
    updatedAt: string
}

const SELECT_TABLE = 'SELECT id, number, description, capacity, status, restaurant_id as restaurantId, created_at as createdAt, updated_at as updatedAt FROM tables'

export interface TableRepository {
    findById(id: string): Promise<Table | null>
    findByRestaurantId(restaurantId: string): Promise<Table[]>
    save(table: Table): Promise<void>
    delete(id: string): Promise<void>
    findAvailable(restaurantId: string, minCapacity: number): Promise<Table[]>
    occupyIfFree(id: string): Promise<boolean>
}

export class SqliteTableRepository implements TableRepository {
    constructor(private db: Database) {}

    async findById(id: string): Promise<Table | null> {
        const row = await this.db.get<TableRow>(`${SELECT_TABLE} WHERE id = ?`, [id])
        if (!row) return null
        return this.mapToTable(row)
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        const rows = await this.db.all<TableRow>(`${SELECT_TABLE} WHERE restaurant_id = ? ORDER BY number ASC`, [restaurantId])
        return rows.map(row => this.mapToTable(row))
    }

    async save(table: Table): Promise<void> {
        const existing = await this.findById(table.id)
        if (existing) {
            await this.db.run(
                'UPDATE tables SET number = ?, description = ?, capacity = ?, status = ?, updated_at = ? WHERE id = ?',
                [table.number, table.description, table.capacity, table.status, table.updatedAt, table.id]
            )
        } else {
            await this.db.run(
                'INSERT INTO tables (id, number, description, capacity, status, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [table.id, table.number, table.description, table.capacity, table.status, table.restaurantId, table.createdAt, table.updatedAt]
            )
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.run('DELETE FROM tables WHERE id = ?', [id])
    }

    async findAvailable(restaurantId: string, minCapacity: number): Promise<Table[]> {
        const rows = await this.db.all<TableRow>(
            `${SELECT_TABLE} WHERE restaurant_id = ? AND status = 'libre' AND capacity >= ? ORDER BY capacity ASC, number ASC`,
            [restaurantId, minCapacity]
        )
        return rows.map(row => this.mapToTable(row))
    }

    /**
     * Ocupa la mesa solo si sigue libre, en una única sentencia para evitar dobles ocupaciones.
     * @returns true si la mesa ha pasado a ocupada, false si no existe o no estaba libre
     */
    async occupyIfFree(id: string): Promise<boolean> {
        const result = await this.db.run(
            "UPDATE tables SET status = 'ocupada', updated_at = ? WHERE id = ? AND status = 'libre'",
            [new Date().toISOString(), id]
        )
        return result.changes > 0
    }

    private mapToTable(row: TableRow): Table {
        return {
            id: row.id,
            number: row.number,
            description: row.description,
            capacity: row.capacity,
            status: normalizeTableStatus(row.status),
            restaurantId: row.restaurantId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }
    }
}
