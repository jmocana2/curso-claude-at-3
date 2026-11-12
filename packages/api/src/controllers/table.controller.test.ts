import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Request, Response } from 'express'
import { TableController } from './table.controller.js'
import { TableService } from '@services/table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import { TableNotFoundError } from '@errors/DomainErrors.js'

function buildRes() {
    return {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
    } as unknown as Response
}

function buildReq(params: Record<string, string>, body: unknown = {}, query: Record<string, unknown> = {}) {
    return { params, body, query } as unknown as Request
}

const tableShape = {
    id: expect.any(String),
    number: 7,
    description: 'Terraza',
    capacity: 4,
    status: 'libre',
    restaurantId: 'r1',
    createdAt: expect.any(String),
    updatedAt: expect.any(String)
}

describe('TableController', () => {
    let service: TableService
    let controller: TableController
    let tableId: string

    beforeEach(async () => {
        service = new TableService(new MockTableRepository())
        controller = new TableController(service)
        tableId = (await service.create({ restaurantId: 'r1', number: 7, capacity: 4, description: 'Terraza' })).id
    })

    it('create should respond 201 with the table', async () => {
        const res = buildRes()
        await controller.create(buildReq({ restaurantId: 'r1' }, { number: 8, capacity: 2 }), res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(201)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ number: 8, capacity: 2, description: null, status: 'libre' }))
    })

    it('create should pass domain errors to next', async () => {
        const next = vi.fn()
        await controller.create(buildReq({ restaurantId: 'r1' }, { number: 0, capacity: 2 }), buildRes(), next)
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'InvalidTableNumberError' }))
    })

    it('getAll should respond 200 with the tables', async () => {
        const res = buildRes()
        await controller.getAll(buildReq({ restaurantId: 'r1' }), res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith([tableShape])
    })

    it('getById should respond 200 with exactly the contract fields', async () => {
        const res = buildRes()
        await controller.getById(buildReq({ restaurantId: 'r1', id: tableId }), res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith(tableShape)
    })

    it('getById should pass TableNotFoundError to next for another restaurant', async () => {
        const next = vi.fn()
        await controller.getById(buildReq({ restaurantId: 'r2', id: tableId }), buildRes(), next)
        expect(next).toHaveBeenCalledWith(expect.any(TableNotFoundError))
    })

    it('update should respond 200 with the updated table', async () => {
        const res = buildRes()
        await controller.update(buildReq({ restaurantId: 'r1', id: tableId }, { number: 7, capacity: 6, description: 'Terraza' }), res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({ ...tableShape, capacity: 6 })
    })

    it('delete should respond 204 without body', async () => {
        const res = buildRes()
        await controller.delete(buildReq({ restaurantId: 'r1', id: tableId }), res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(204)
        expect(res.send).toHaveBeenCalledWith()
    })

    it('changeStatus should respond 200 with the new status', async () => {
        const res = buildRes()
        await controller.changeStatus(buildReq({ restaurantId: 'r1', id: tableId }, { status: 'reservada' }), res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({ ...tableShape, status: 'reservada' })
    })

    it('getAvailable should respond 200 with the free tables', async () => {
        const res = buildRes()
        await controller.getAvailable(buildReq({ restaurantId: 'r1' }, {}, { people: '3' }), res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith([tableShape])
    })

    it('occupy should respond 200 with the occupied table', async () => {
        const res = buildRes()
        await controller.occupy(buildReq({ restaurantId: 'r1', id: tableId }), res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({ ...tableShape, status: 'ocupada' })
    })
})
