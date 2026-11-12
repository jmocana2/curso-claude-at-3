import { describe, it, expect } from 'vitest'
import { normalizeTableStatus } from './table.model.js'
import { InvalidTableStatusError } from '@errors/DomainErrors.js'

describe('normalizeTableStatus', () => {
    it.each(['libre', 'ocupada', 'reservada'])('should accept %s', (status) => {
        expect(normalizeTableStatus(status)).toBe(status)
    })

    it('should trim and lowercase the value', () => {
        expect(normalizeTableStatus('  Libre ')).toBe('libre')
        expect(normalizeTableStatus('OCUPADA')).toBe('ocupada')
    })

    it('should throw InvalidTableStatusError for an unknown status', () => {
        expect(() => normalizeTableStatus('rota')).toThrow(InvalidTableStatusError)
    })

    it('should throw InvalidTableStatusError for an empty or non string value', () => {
        expect(() => normalizeTableStatus('')).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus(undefined as unknown as string)).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus(3 as unknown as string)).toThrow(InvalidTableStatusError)
    })
})
