import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Database } from '@config/database.js'
import { SqliteTableRepository } from './table.repository.js'
import type { Table } from '@models/table.model.js'

const now = new Date().toISOString()

function buildTable(overrides: Partial<Table> = {}): Table {
    return {
        id: 'table-1',
        number: 1,
        description: null,
        capacity: 4,
        status: 'libre',
        restaurantId: 'r1',
        createdAt: now,
        updatedAt: now,
        ...overrides
    }
}

async function insertRestaurant(db: Database, id: string): Promise<void> {
    await db.run(
        'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, `Restaurant ${id}`, 'Calle Mayor 10', `${id}@resttek.com`, '+34 612345678', 'Carlos', 'García', now, now]
    )
}

describe('tables schema', () => {
    let db: Database

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        await insertRestaurant(db, 'r1')
        await insertRestaurant(db, 'r2')
    })

    afterAll(async () => {
        await db.close()
    })

    const insertTable = (id: string, restaurantId: string, number: number) => db.run(
        'INSERT INTO tables (id, number, description, capacity, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, number, null, 4, restaurantId, now, now]
    )

    it('should create tables with status libre by default', async () => {
        await insertTable('t1', 'r1', 1)
        const row = await db.get<{ status: string }>('SELECT status FROM tables WHERE id = ?', ['t1'])
        expect(row?.status).toBe('libre')
    })

    it('should reject a duplicated number in the same restaurant', async () => {
        await expect(insertTable('t2', 'r1', 1)).rejects.toThrow(/UNIQUE/)
    })

    it('should allow the same number in another restaurant', async () => {
        await expect(insertTable('t3', 'r2', 1)).resolves.toBeDefined()
    })

    it('should reject a table of an unknown restaurant', async () => {
        await expect(insertTable('t4', 'unknown', 1)).rejects.toThrow(/FOREIGN KEY/)
    })
})

describe('SqliteTableRepository (Integration)', () => {
    let db: Database
    let repo: SqliteTableRepository

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteTableRepository(db)
        await insertRestaurant(db, 'r1')
        await insertRestaurant(db, 'r2')
    })

    afterAll(async () => {
        await db.close()
    })

    it('should save and find a table by id', async () => {
        await repo.save(buildTable({ id: 'a1', number: 3, description: 'Terraza', capacity: 2 }))

        const found = await repo.findById('a1')
        expect(found).toEqual(buildTable({ id: 'a1', number: 3, description: 'Terraza', capacity: 2 }))
    })

    it('should return null when the table does not exist', async () => {
        expect(await repo.findById('missing')).toBeNull()
    })

    it('should find the tables of a restaurant ordered by number', async () => {
        await repo.save(buildTable({ id: 'a2', number: 1 }))
        await repo.save(buildTable({ id: 'a3', number: 2 }))
        await repo.save(buildTable({ id: 'b1', number: 1, restaurantId: 'r2' }))

        const results = await repo.findByRestaurantId('r1')
        expect(results.map(t => t.id)).toEqual(['a2', 'a3', 'a1'])
    })

    it('should update an existing table', async () => {
        const later = new Date(Date.now() + 1000).toISOString()
        await repo.save(buildTable({ id: 'a1', number: 9, description: null, capacity: 6, status: 'reservada', updatedAt: later }))

        const found = await repo.findById('a1')
        expect(found).toMatchObject({ number: 9, description: null, capacity: 6, status: 'reservada', updatedAt: later, createdAt: now })
    })

    it('should delete a table', async () => {
        await repo.save(buildTable({ id: 'd1', number: 50 }))
        await repo.delete('d1')
        expect(await repo.findById('d1')).toBeNull()
    })

    it('should find free tables with enough capacity ordered by capacity and number', async () => {
        await repo.save(buildTable({ id: 'v1', number: 21, capacity: 6, restaurantId: 'r2' }))
        await repo.save(buildTable({ id: 'v2', number: 22, capacity: 4, restaurantId: 'r2' }))
        await repo.save(buildTable({ id: 'v3', number: 20, capacity: 4, restaurantId: 'r2' }))
        await repo.save(buildTable({ id: 'v4', number: 23, capacity: 2, restaurantId: 'r2' }))
        await repo.save(buildTable({ id: 'v5', number: 24, capacity: 8, status: 'ocupada', restaurantId: 'r2' }))
        await repo.save(buildTable({ id: 'v6', number: 25, capacity: 8, status: 'reservada', restaurantId: 'r2' }))

        const results = await repo.findAvailable('r2', 3)
        expect(results.map(t => t.id)).toEqual(['b1', 'v3', 'v2', 'v1'])
    })

    it('should return an empty list for an unknown restaurant', async () => {
        expect(await repo.findAvailable('unknown', 1)).toEqual([])
    })

    it('should occupy a free table only once', async () => {
        await repo.save(buildTable({ id: 'o1', number: 60 }))

        const results = await Promise.all([repo.occupyIfFree('o1'), repo.occupyIfFree('o1')])

        expect(results.filter(Boolean)).toHaveLength(1)
        const found = await repo.findById('o1')
        expect(found?.status).toBe('ocupada')
        expect(found!.updatedAt > now).toBe(true)
    })

    it('should not occupy a reserved table', async () => {
        await repo.save(buildTable({ id: 'o2', number: 61, status: 'reservada' }))

        expect(await repo.occupyIfFree('o2')).toBe(false)
        expect((await repo.findById('o2'))?.status).toBe('reservada')
    })

    it('should return false when the table does not exist', async () => {
        expect(await repo.occupyIfFree('missing')).toBe(false)
    })
})
