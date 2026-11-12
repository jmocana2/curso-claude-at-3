import { randomUUID } from 'crypto'
import type { Table, TableStatusType } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import {
    InvalidTableNumberError,
    InvalidTableCapacityError,
    DuplicatedTableNumberError,
    RestaurantIdRequiredError,
    TableNotFoundError,
    TableNotAvailableError,
    InvalidPeopleCountError
} from '@errors/DomainErrors.js'

export interface CreateTableDTO {
    restaurantId: string
    number: unknown
    capacity: unknown
    description?: unknown
    status?: unknown
}

export interface UpdateTableDTO {
    number: unknown
    capacity: unknown
    description?: unknown
    status?: unknown
}

export class TableService {
    constructor(private readonly tableRepository: TableRepository) {}

    async create(dto: CreateTableDTO): Promise<Table> {
        if (!dto.restaurantId || dto.restaurantId.trim() === '') {
            throw new RestaurantIdRequiredError()
        }

        const number = this.validateNumber(dto.number)
        const capacity = this.validateCapacity(dto.capacity)
        const status = this.resolveStatus(dto.status, 'libre')

        await this.ensureNumberIsFree(dto.restaurantId, number)

        const now = new Date().toISOString()
        const table: Table = {
            id: randomUUID(),
            number,
            description: this.normalizeDescription(dto.description),
            capacity,
            status,
            restaurantId: dto.restaurantId,
            createdAt: now,
            updatedAt: now
        }

        await this.tableRepository.save(table)
        return table
    }

    async update(restaurantId: string, id: string, dto: UpdateTableDTO): Promise<Table> {
        const existing = await this.findOwnedTable(restaurantId, id)

        const number = this.validateNumber(dto.number)
        const capacity = this.validateCapacity(dto.capacity)
        const status = this.resolveStatus(dto.status, existing.status)

        await this.ensureNumberIsFree(restaurantId, number, id)

        const updated: Table = {
            ...existing,
            number,
            description: this.normalizeDescription(dto.description),
            capacity,
            status,
            updatedAt: new Date().toISOString()
        }

        await this.tableRepository.save(updated)
        return updated
    }

    async delete(restaurantId: string, id: string): Promise<void> {
        await this.findOwnedTable(restaurantId, id)
        await this.tableRepository.delete(id)
    }

    async changeStatus(restaurantId: string, id: string, status: unknown): Promise<Table> {
        const existing = await this.findOwnedTable(restaurantId, id)
        const updated: Table = {
            ...existing,
            status: normalizeTableStatus(status as string),
            updatedAt: new Date().toISOString()
        }

        await this.tableRepository.save(updated)
        return updated
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        return this.tableRepository.findByRestaurantId(restaurantId)
    }

    async findById(restaurantId: string, id: string): Promise<Table> {
        return this.findOwnedTable(restaurantId, id)
    }

    async findAvailable(restaurantId: string, people: unknown): Promise<Table[]> {
        return this.tableRepository.findAvailable(restaurantId, this.parsePeople(people))
    }

    async occupy(restaurantId: string, id: string): Promise<Table> {
        await this.findOwnedTable(restaurantId, id)

        const occupied = await this.tableRepository.occupyIfFree(id)
        if (!occupied) {
            throw new TableNotAvailableError()
        }

        return this.findOwnedTable(restaurantId, id)
    }

    private parsePeople(value: unknown): number {
        const people = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
        if (!this.isPositiveInteger(people)) {
            throw new InvalidPeopleCountError()
        }
        return people
    }

    private async findOwnedTable(restaurantId: string, id: string): Promise<Table> {
        const table = await this.tableRepository.findById(id)
        if (!table || table.restaurantId !== restaurantId) {
            throw new TableNotFoundError()
        }
        return table
    }

    private resolveStatus(value: unknown, fallback: TableStatusType): TableStatusType {
        if (value === undefined || value === null) return fallback
        return normalizeTableStatus(value as string)
    }

    private validateNumber(value: unknown): number {
        if (!this.isPositiveInteger(value)) {
            throw new InvalidTableNumberError()
        }
        return value
    }

    private validateCapacity(value: unknown): number {
        if (!this.isPositiveInteger(value)) {
            throw new InvalidTableCapacityError()
        }
        return value
    }

    private isPositiveInteger(value: unknown): value is number {
        return typeof value === 'number' && Number.isInteger(value) && value > 0
    }

    private normalizeDescription(value: unknown): string | null {
        if (typeof value !== 'string') return null
        const trimmed = value.trim()
        return trimmed === '' ? null : trimmed
    }

    private async ensureNumberIsFree(restaurantId: string, number: number, excludedId?: string): Promise<void> {
        const tables = await this.tableRepository.findByRestaurantId(restaurantId)
        if (tables.some(t => t.number === number && t.id !== excludedId)) {
            throw new DuplicatedTableNumberError()
        }
    }
}
