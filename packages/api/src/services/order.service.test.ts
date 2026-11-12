import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService } from './order.service.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import type { Order } from '@models/order.model.js'
import { OrderNotFoundError, InvalidOrderStatusError, TableNotFoundError } from '@errors/DomainErrors.js'

describe('OrderService.updateItemStatus', () => {
    let repo: MockOrderRepository
    let service: OrderService
    let testOrder: Order

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo, new MockTableRepository())

        testOrder = {
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: null,
            createdAt: new Date(),
            items: [
                { id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' }
            ]
        }
        await repo.create(testOrder)
    })

    it('should update the status of an item successfully', async () => {
        await service.updateItemStatus('order-1', 'item-1', 'preparando')
        const updatedItem = testOrder.items[0]!
        expect(updatedItem.status).toBe('preparando')
    })

    it('should throw an error if the order does not exist', async () => {
        await expect(service.updateItemStatus('order-bad', 'item-1', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw an error if the item does not exist inside the order', async () => {
        await expect(service.updateItemStatus('order-1', 'item-bad', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw DomainError if status is invalid', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'invalid-status'))
            .rejects.toThrow(InvalidOrderStatusError)
    })
})

describe('OrderService.create (table)', () => {
    let repo: MockOrderRepository
    let tables: MockTableRepository
    let service: OrderService
    const now = new Date().toISOString()
    const items = [{ dishId: 'dish-1', quantity: 2, notes: null }]

    beforeEach(async () => {
        repo = new MockOrderRepository()
        tables = new MockTableRepository()
        service = new OrderService(repo, tables)
        await tables.save({ id: 'table-1', number: 1, description: null, capacity: 4, status: 'ocupada', restaurantId: 'rest-1', createdAt: now, updatedAt: now })
        await tables.save({ id: 'table-2', number: 1, description: null, capacity: 4, status: 'libre', restaurantId: 'rest-2', createdAt: now, updatedAt: now })
    })

    it('should save the order with a table of the same restaurant', async () => {
        const order = await service.create({ restaurantId: 'rest-1', tableId: 'table-1', clientId: 'c1', items })

        expect(order.tableId).toBe('table-1')
        expect(order.items).toHaveLength(2)
        expect(repo.orders).toHaveLength(1)
    })

    it('should save the order without table', async () => {
        const order = await service.create({ restaurantId: 'rest-1', tableId: null, clientId: 'c1', items })
        expect(order.tableId).toBeNull()
        expect(repo.orders).toHaveLength(1)
    })

    it.each(['missing', 'table-2'])('should throw TableNotFoundError and not save the order for table %s', async (tableId) => {
        await expect(service.create({ restaurantId: 'rest-1', tableId, clientId: 'c1', items }))
            .rejects.toThrow(TableNotFoundError)
        expect(repo.orders).toHaveLength(0)
    })
})
