import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET: string = process.env.JWT_SECRET || 'super-secret-resttek-key'

export interface AuthRequest extends Request {
    user?: any
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' })
        return
    }

    const tokenParts = authHeader.split(' ')
    const token = tokenParts[1]
    if (!token) {
        res.status(401).json({ error: 'Unauthorized: Malformed token' })
        return
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        req.user = decoded
        next()
    } catch {
        res.status(401).json({ error: 'Unauthorized: Invalid token' })
    }
}

export const authorize = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
            return
        }
        next()
    }
}

/**
 * Restringe el acceso al restaurante de la ruta (`:restaurantId`): `admin` accede a cualquiera
 * y el resto de roles solo al restaurante de su token. Debe ir después de `authenticate`.
 */
export const authorizeRestaurant = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const isAllowed = req.user?.role === 'admin' || (req.user && req.user.restaurantId === req.params.restaurantId)
    if (!isAllowed) {
        res.status(403).json({ error: 'Forbidden: Restaurant access denied' })
        return
    }
    next()
}
