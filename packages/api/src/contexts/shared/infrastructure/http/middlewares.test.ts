import { describe, it, expect, vi } from 'vitest'
import type { Response } from 'express'
import { authorizeRestaurant, type AuthRequest } from './middlewares.js'

function run(user: unknown, restaurantId: string) {
    const req = { user, params: { restaurantId } } as unknown as AuthRequest
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
    } as unknown as Response
    const next = vi.fn()
    authorizeRestaurant(req, res, next)
    return { res, next }
}

describe('authorizeRestaurant', () => {
    it('should let an admin access any restaurant', () => {
        const { next, res } = run({ id: 'a', role: 'admin', restaurantId: null }, 'rest-2')
        expect(next).toHaveBeenCalled()
        expect(res.status).not.toHaveBeenCalled()
    })

    it.each(['manager', 'camarero'])('should let a %s access their own restaurant', (role) => {
        const { next } = run({ id: 'e', role, restaurantId: 'rest-1' }, 'rest-1')
        expect(next).toHaveBeenCalled()
    })

    it.each(['manager', 'camarero'])('should forbid a %s from accessing another restaurant', (role) => {
        const { next, res } = run({ id: 'e', role, restaurantId: 'rest-1' }, 'rest-2')
        expect(next).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: Restaurant access denied' })
    })

    it('should forbid a request without user', () => {
        const { next, res } = run(undefined, 'rest-1')
        expect(next).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
    })
})
