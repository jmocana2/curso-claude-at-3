import { describe, it, expect, beforeEach } from 'vitest'
import { TableService } from './table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import {
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidTableStatusError,
    DuplicatedTableNumberError,
    RestaurantIdRequiredError,
    TableNotFoundError,
    TableNotAvailableError,
    InvalidPeopleCountError
} from '@errors/DomainErrors.js'

describe('TableService', () => {
    let repo: MockTableRepository
    let service: TableService

    beforeEach(() => {
        repo = new MockTableRepository()
        service = new TableService(repo)
    })

    describe('create', () => {
        it('should create a free table with trimmed description', async () => {
            const table = await service.create({ restaurantId: 'r1', number: 7, capacity: 4, description: '  Terraza ' })

            expect(table).toMatchObject({ restaurantId: 'r1', number: 7, capacity: 4, description: 'Terraza', status: 'libre' })
            expect(table.id).toBeTruthy()
            expect(table.createdAt).toBe(table.updatedAt)
            expect(await repo.findById(table.id)).toEqual(table)
        })

        it.each([undefined, null, '', '   '])('should store a null description when it is %j', async (description) => {
            const table = await service.create({ restaurantId: 'r1', number: 1, capacity: 2, description })
            expect(table.description).toBeNull()
        })

        it('should accept and normalize an initial status', async () => {
            const table = await service.create({ restaurantId: 'r1', number: 1, capacity: 2, status: ' Reservada ' })
            expect(table.status).toBe('reservada')
        })

        it.each([undefined, 0, -1, 1.5, '7', null])('should reject number %j', async (number) => {
            await expect(service.create({ restaurantId: 'r1', number, capacity: 2 }))
                .rejects.toThrow(InvalidTableNumberError)
        })

        it.each([undefined, 0, -3, 2.5, '4', null])('should reject capacity %j', async (capacity) => {
            await expect(service.create({ restaurantId: 'r1', number: 1, capacity }))
                .rejects.toThrow(InvalidTableCapacityError)
        })

        it('should reject an invalid status', async () => {
            await expect(service.create({ restaurantId: 'r1', number: 1, capacity: 2, status: 'rota' }))
                .rejects.toThrow(InvalidTableStatusError)
        })

        it('should require the restaurant id', async () => {
            await expect(service.create({ restaurantId: ' ', number: 1, capacity: 2 }))
                .rejects.toThrow(RestaurantIdRequiredError)
        })

        it('should reject a duplicated number in the same restaurant', async () => {
            await service.create({ restaurantId: 'r1', number: 7, capacity: 4 })
            await expect(service.create({ restaurantId: 'r1', number: 7, capacity: 2 }))
                .rejects.toThrow(DuplicatedTableNumberError)
        })

        it('should allow the same number in another restaurant', async () => {
            await service.create({ restaurantId: 'r1', number: 7, capacity: 4 })
            await expect(service.create({ restaurantId: 'r2', number: 7, capacity: 4 })).resolves.toBeDefined()
        })
    })

    describe('update', () => {
        it('should replace number, capacity and description and keep the status when not sent', async () => {
            const created = await service.create({ restaurantId: 'r1', number: 7, capacity: 4, description: 'Terraza', status: 'ocupada' })

            const updated = await service.update('r1', created.id, { number: 8, capacity: 6, description: ' Ventana ' })

            expect(updated).toMatchObject({ id: created.id, number: 8, capacity: 6, description: 'Ventana', status: 'ocupada', restaurantId: 'r1', createdAt: created.createdAt })
            expect(await repo.findById(created.id)).toEqual(updated)
        })

        it('should clear the description when it is not sent', async () => {
            const created = await service.create({ restaurantId: 'r1', number: 7, capacity: 4, description: 'Terraza' })
            const updated = await service.update('r1', created.id, { number: 7, capacity: 4 })
            expect(updated.description).toBeNull()
        })

        it('should change the status when it is sent', async () => {
            const created = await service.create({ restaurantId: 'r1', number: 7, capacity: 4 })
            const updated = await service.update('r1', created.id, { number: 7, capacity: 4, status: 'reservada' })
            expect(updated.status).toBe('reservada')
        })

        it('should validate number, capacity and status', async () => {
            const created = await service.create({ restaurantId: 'r1', number: 7, capacity: 4 })
            await expect(service.update('r1', created.id, { number: 0, capacity: 4 })).rejects.toThrow(InvalidTableNumberError)
            await expect(service.update('r1', created.id, { number: 7, capacity: 1.5 })).rejects.toThrow(InvalidTableCapacityError)
            await expect(service.update('r1', created.id, { number: 7, capacity: 4, status: 'rota' })).rejects.toThrow(InvalidTableStatusError)
        })

        it('should allow keeping its own number but not taking another table number', async () => {
            const first = await service.create({ restaurantId: 'r1', number: 1, capacity: 4 })
            await service.create({ restaurantId: 'r1', number: 2, capacity: 4 })

            await expect(service.update('r1', first.id, { number: 1, capacity: 2 })).resolves.toBeDefined()
            await expect(service.update('r1', first.id, { number: 2, capacity: 2 })).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('should throw TableNotFoundError for an unknown table or a table of another restaurant', async () => {
            const created = await service.create({ restaurantId: 'r1', number: 1, capacity: 4 })
            await expect(service.update('r1', 'missing', { number: 1, capacity: 4 })).rejects.toThrow(TableNotFoundError)
            await expect(service.update('r2', created.id, { number: 1, capacity: 4 })).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('delete', () => {
        it('should delete a table', async () => {
            const created = await service.create({ restaurantId: 'r1', number: 1, capacity: 4 })
            await service.delete('r1', created.id)
            expect(await repo.findById(created.id)).toBeNull()
        })

        it('should throw TableNotFoundError for an unknown table or a table of another restaurant', async () => {
            const created = await service.create({ restaurantId: 'r1', number: 1, capacity: 4 })
            await expect(service.delete('r1', 'missing')).rejects.toThrow(TableNotFoundError)
            await expect(service.delete('r2', created.id)).rejects.toThrow(TableNotFoundError)
            expect(await repo.findById(created.id)).not.toBeNull()
        })
    })

    describe('changeStatus', () => {
        it.each(['ocupada', 'reservada', 'libre', ' Libre '])('should change the status to %j', async (status) => {
            const created = await service.create({ restaurantId: 'r1', number: 1, capacity: 4 })

            const updated = await service.changeStatus('r1', created.id, status)

            expect(updated.status).toBe(status.trim().toLowerCase())
            expect((await repo.findById(created.id))?.status).toBe(updated.status)
        })

        it.each([undefined, '', 'rota'])('should reject status %j', async (status) => {
            const created = await service.create({ restaurantId: 'r1', number: 1, capacity: 4 })
            await expect(service.changeStatus('r1', created.id, status)).rejects.toThrow(InvalidTableStatusError)
        })

        it('should throw TableNotFoundError for an unknown table or a table of another restaurant', async () => {
            const created = await service.create({ restaurantId: 'r1', number: 1, capacity: 4 })
            await expect(service.changeStatus('r1', 'missing', 'libre')).rejects.toThrow(TableNotFoundError)
            await expect(service.changeStatus('r2', created.id, 'libre')).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('queries', () => {
        it('should list the tables of a restaurant ordered by number', async () => {
            await service.create({ restaurantId: 'r1', number: 2, capacity: 4 })
            await service.create({ restaurantId: 'r1', number: 1, capacity: 4 })
            await service.create({ restaurantId: 'r2', number: 3, capacity: 4 })

            const tables = await service.findByRestaurantId('r1')
            expect(tables.map(t => t.number)).toEqual([1, 2])
        })

        it('should find a table of the restaurant by id', async () => {
            const created = await service.create({ restaurantId: 'r1', number: 1, capacity: 4 })
            expect(await service.findById('r1', created.id)).toEqual(created)
        })

        it('should throw TableNotFoundError when finding a table of another restaurant', async () => {
            const created = await service.create({ restaurantId: 'r1', number: 1, capacity: 4 })
            await expect(service.findById('r2', created.id)).rejects.toThrow(TableNotFoundError)
            await expect(service.findById('r1', 'missing')).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('findAvailable', () => {
        beforeEach(async () => {
            await service.create({ restaurantId: 'r1', number: 1, capacity: 2 })
            await service.create({ restaurantId: 'r1', number: 2, capacity: 6 })
            await service.create({ restaurantId: 'r1', number: 3, capacity: 4 })
            await service.create({ restaurantId: 'r1', number: 4, capacity: 8, status: 'ocupada' })
            await service.create({ restaurantId: 'r2', number: 5, capacity: 8 })
        })

        it.each([3, '3'])('should return free tables with enough capacity for %j people', async (people) => {
            const tables = await service.findAvailable('r1', people)
            expect(tables.map(t => t.number)).toEqual([3, 2])
        })

        it.each([undefined, null, '', 'abc', '0', 0, '-2', '2.5', 2.5, '3abc'])('should reject people %j', async (people) => {
            await expect(service.findAvailable('r1', people)).rejects.toThrow(InvalidPeopleCountError)
        })
    })

    describe('occupy', () => {
        it('should occupy a free table and return it updated', async () => {
            const created = await service.create({ restaurantId: 'r1', number: 1, capacity: 4 })

            const occupied = await service.occupy('r1', created.id)

            expect(occupied).toMatchObject({ id: created.id, status: 'ocupada' })
            expect((await repo.findById(created.id))?.status).toBe('ocupada')
        })

        it.each(['ocupada', 'reservada'])('should throw TableNotAvailableError when the table is %s', async (status) => {
            const created = await service.create({ restaurantId: 'r1', number: 1, capacity: 4, status })
            await expect(service.occupy('r1', created.id)).rejects.toThrow(TableNotAvailableError)
        })

        it('should throw TableNotFoundError for an unknown table or a table of another restaurant', async () => {
            const created = await service.create({ restaurantId: 'r1', number: 1, capacity: 4 })
            await expect(service.occupy('r1', 'missing')).rejects.toThrow(TableNotFoundError)
            await expect(service.occupy('r2', created.id)).rejects.toThrow(TableNotFoundError)
            expect((await repo.findById(created.id))?.status).toBe('libre')
        })
    })
})
