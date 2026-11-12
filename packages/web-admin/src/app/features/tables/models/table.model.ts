export type TableStatus = 'libre' | 'ocupada' | 'reservada'

export interface Table {
  id: string
  number: number
  description: string | null
  capacity: number
  status: TableStatus
  restaurantId: string
  createdAt: string
  updatedAt: string
}

export interface CreateTableDto {
  number: number
  capacity: number
  description?: string | null
}

export interface UpdateTableDto {
  number: number
  capacity: number
  description?: string | null
}
