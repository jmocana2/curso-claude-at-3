import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { errorHandler } from './errorHandler.js'
import {
    TableNotFoundError,
    DuplicatedTableNumberError,
    TableNotAvailableError,
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidTableStatusError,
    InvalidPeopleCountError
} from '@errors/DomainErrors.js'

function run(error: unknown) {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
    } as unknown as Response
    errorHandler(error, {} as Request, res, vi.fn() as NextFunction)
    return res
}

describe('errorHandler (tables)', () => {
    it('should map TableNotFoundError to 404', () => {
        const res = run(new TableNotFoundError())
        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({ error: 'TableNotFoundError', message: 'Table not found' })
    })

    it.each([
        [new DuplicatedTableNumberError(), 'DuplicatedTableNumberError'],
        [new TableNotAvailableError(), 'TableNotAvailableError']
    ])('should map %s to 409', (error, name) => {
        const res = run(error)
        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: name }))
    })

    it.each([
        new InvalidTableNumberError(),
        new InvalidTableCapacityError(),
        new InvalidTableStatusError(),
        new InvalidPeopleCountError()
    ])('should map %s to 400', (error) => {
        const res = run(error)
        expect(res.status).toHaveBeenCalledWith(400)
    })
})
