import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'
import { dbConfig } from '@config/database.js'

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-resttek-key'
const now = new Date().toISOString()
const BASE = '/api/v1/restaurants'

function tokenFor(role: string, restaurantId: string | null = null): string {
    return `Bearer ${jwt.sign({ id: `${role}-${restaurantId}`, role, restaurantId }, JWT_SECRET)}`
}

const admin = tokenFor('admin')
const camareroR1 = tokenFor('camarero', 'r1')
const managerR1 = tokenFor('manager', 'r1')
const cocineroR1 = tokenFor('cocinero', 'r1')
const cliente = tokenFor('cliente')

async function insertRestaurant(id: string): Promise<void> {
    await dbConfig.run(
        'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, `Restaurant ${id}`, 'Calle Mayor 10', `${id}@resttek.com`, '+34 612345678', 'Carlos', 'García', now, now]
    )
}

async function insertTable(id: string, restaurantId: string, number: number, capacity: number, status = 'libre'): Promise<void> {
    await dbConfig.run(
        'INSERT INTO tables (id, number, description, capacity, status, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, number, null, capacity, status, restaurantId, now, now]
    )
}

describe('Table routes', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
        await insertRestaurant('r1')
        await insertRestaurant('r2')
    })

    beforeEach(async () => {
        await dbConfig.run('DELETE FROM tables')
        await insertTable('t1', 'r1', 1, 2)
        await insertTable('t2', 'r1', 2, 4)
        await insertTable('t3', 'r2', 1, 4)
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    describe('authentication and roles', () => {
        it('should respond 401 without token', async () => {
            const res = await request(app).get(`${BASE}/r1/tables`)
            expect(res.status).toBe(401)
        })

        it.each([
            ['admin', admin],
            ['manager', managerR1],
            ['camarero', camareroR1]
        ])('should let %s list the tables of r1', async (_role, token) => {
            const res = await request(app).get(`${BASE}/r1/tables`).set('Authorization', token)
            expect(res.status).toBe(200)
            expect(res.body.map((t: { id: string }) => t.id)).toEqual(['t1', 't2'])
        })

        it.each([
            ['cocinero', cocineroR1],
            ['cliente', cliente]
        ])('should forbid %s from listing tables', async (_role, token) => {
            const res = await request(app).get(`${BASE}/r1/tables`).set('Authorization', token)
            expect(res.status).toBe(403)
        })

        it('should forbid an employee of r1 from accessing r2', async () => {
            const list = await request(app).get(`${BASE}/r2/tables`).set('Authorization', camareroR1)
            const detail = await request(app).get(`${BASE}/r2/tables/t3`).set('Authorization', camareroR1)
            const status = await request(app).patch(`${BASE}/r2/tables/t3/status`).set('Authorization', managerR1).send({ status: 'libre' })
            expect([list.status, detail.status, status.status]).toEqual([403, 403, 403])
            expect(list.body).toEqual({ error: 'Forbidden: Restaurant access denied' })
        })

        it('should let the admin access any restaurant', async () => {
            const res = await request(app).get(`${BASE}/r2/tables/t3`).set('Authorization', admin)
            expect(res.status).toBe(200)
        })

        it.each([
            ['manager', managerR1],
            ['camarero', camareroR1],
            ['cocinero', cocineroR1],
            ['cliente', cliente]
        ])('should forbid %s from creating, updating and deleting tables', async (_role, token) => {
            const create = await request(app).post(`${BASE}/r1/tables`).set('Authorization', token).send({ number: 9, capacity: 2 })
            const update = await request(app).put(`${BASE}/r1/tables/t1`).set('Authorization', token).send({ number: 1, capacity: 2 })
            const remove = await request(app).delete(`${BASE}/r1/tables/t1`).set('Authorization', token)
            expect([create.status, update.status, remove.status]).toEqual([403, 403, 403])
        })

        it.each([
            ['camarero', camareroR1],
            ['cocinero', cocineroR1]
        ])('should only let clients query available tables and occupy them (%s)', async (_role, token) => {
            const available = await request(app).get(`${BASE}/r1/tables/available?people=2`).set('Authorization', token)
            const occupy = await request(app).post(`${BASE}/r1/tables/t1/occupy`).set('Authorization', token)
            expect([available.status, occupy.status]).toEqual([403, 403])
        })

        it('should resolve /available before /:id', async () => {
            const res = await request(app).get(`${BASE}/r1/tables/available?people=3`).set('Authorization', cliente)
            expect(res.status).toBe(200)
            expect(res.body.map((t: { id: string }) => t.id)).toEqual(['t2'])
        })
    })

    describe('status codes', () => {
        it('should create a table with 201 and status libre', async () => {
            const res = await request(app).post(`${BASE}/r1/tables`).set('Authorization', admin).send({ number: 7, capacity: 4, description: 'Terraza' })
            expect(res.status).toBe(201)
            expect(res.body).toEqual({
                id: expect.any(String),
                number: 7,
                description: 'Terraza',
                capacity: 4,
                status: 'libre',
                restaurantId: 'r1',
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
            })
        })

        it.each([
            [{ number: 0, capacity: 4 }, 'InvalidTableNumberError'],
            [{ number: 7, capacity: 2.5 }, 'InvalidTableCapacityError'],
            [{ number: 7, capacity: 4, status: 'rota' }, 'InvalidTableStatusError']
        ])('should respond 400 when creating with %j', async (body, error) => {
            const res = await request(app).post(`${BASE}/r1/tables`).set('Authorization', admin).send(body)
            expect(res.status).toBe(400)
            expect(res.body).toEqual({ error, message: expect.any(String) })
        })

        it('should respond 409 with a duplicated number in the same restaurant but allow it in another', async () => {
            const duplicated = await request(app).post(`${BASE}/r1/tables`).set('Authorization', admin).send({ number: 1, capacity: 4 })
            const otherRestaurant = await request(app).post(`${BASE}/r2/tables`).set('Authorization', admin).send({ number: 2, capacity: 4 })
            expect(duplicated.status).toBe(409)
            expect(duplicated.body.error).toBe('DuplicatedTableNumberError')
            expect(otherRestaurant.status).toBe(201)
        })

        it('should update a table with 200 and respond 409 when taking another number', async () => {
            const ok = await request(app).put(`${BASE}/r1/tables/t1`).set('Authorization', admin).send({ number: 5, capacity: 6 })
            const conflict = await request(app).put(`${BASE}/r1/tables/t1`).set('Authorization', admin).send({ number: 2, capacity: 6 })
            expect(ok.status).toBe(200)
            expect(ok.body).toMatchObject({ id: 't1', number: 5, capacity: 6, status: 'libre' })
            expect(conflict.status).toBe(409)
        })

        it('should delete a table with 204', async () => {
            const res = await request(app).delete(`${BASE}/r1/tables/t1`).set('Authorization', admin)
            expect(res.status).toBe(204)
            expect(res.text).toBe('')
        })

        it.each([
            ['get', 'missing'],
            ['put', 'missing'],
            ['delete', 'missing'],
            ['get', 't3'],
            ['put', 't3'],
            ['delete', 't3']
        ] as const)('should respond 404 on %s of table %s in r1', async (method, id) => {
            const res = await request(app)[method](`${BASE}/r1/tables/${id}`).set('Authorization', admin).send({ number: 1, capacity: 4 })
            expect(res.status).toBe(404)
            expect(res.body).toEqual({ error: 'TableNotFoundError', message: 'Table not found' })
        })

        it('should change the status with 200 and reject an invalid status with 400', async () => {
            const ok = await request(app).patch(`${BASE}/r1/tables/t1/status`).set('Authorization', camareroR1).send({ status: 'reservada' })
            const invalid = await request(app).patch(`${BASE}/r1/tables/t1/status`).set('Authorization', camareroR1).send({ status: 'rota' })
            const missing = await request(app).patch(`${BASE}/r1/tables/missing/status`).set('Authorization', camareroR1).send({ status: 'libre' })
            expect(ok.status).toBe(200)
            expect(ok.body.status).toBe('reservada')
            expect(invalid.status).toBe(400)
            expect(missing.status).toBe(404)
        })

        it.each(['', '?people=0', '?people=abc'])('should respond 400 on available tables with %j', async (query) => {
            const res = await request(app).get(`${BASE}/r1/tables/available${query}`).set('Authorization', cliente)
            expect(res.status).toBe(400)
            expect(res.body.error).toBe('InvalidPeopleCountError')
        })

        it('should occupy a free table with 200 and respond 409 the second time', async () => {
            const first = await request(app).post(`${BASE}/r1/tables/t1/occupy`).set('Authorization', cliente)
            const second = await request(app).post(`${BASE}/r1/tables/t1/occupy`).set('Authorization', cliente)
            expect(first.status).toBe(200)
            expect(first.body).toMatchObject({ id: 't1', status: 'ocupada' })
            expect(second.status).toBe(409)
            expect(second.body).toEqual({ error: 'TableNotAvailableError', message: 'Table is not available' })
        })

        it('should respond 404 when occupying a table of another restaurant', async () => {
            const res = await request(app).post(`${BASE}/r1/tables/t3/occupy`).set('Authorization', cliente)
            expect(res.status).toBe(404)
        })
    })

    describe('POST /api/v1/orders with tableId', () => {
        it.each(['missing', 't3'])('should respond 400 and not create the order for table %s', async (tableId) => {
            const res = await request(app).post('/api/v1/orders').set('Authorization', cliente)
                .send({ restaurantId: 'r1', tableId, items: [{ dishId: 'dish-1', quantity: 1, notes: null }] })

            expect(res.status).toBe(400)
            expect(res.body).toEqual({ error: 'Table not found' })
            const row = await dbConfig.get<{ total: number }>('SELECT COUNT(*) as total FROM orders')
            expect(row?.total).toBe(0)
        })
    })
})
