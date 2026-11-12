import { Router } from 'express'
import { TableController } from '@controllers/table.controller.js'
import { dbConfig } from '@config/database.js'
import { SqliteTableRepository } from '@repositories/table.repository.js'
import { TableService } from '@services/table.service.js'
import { authenticate, authorize, authorizeRestaurant } from '@shared/infrastructure/http/middlewares.js'

const tableRepository = new SqliteTableRepository(dbConfig)
const tableService = new TableService(tableRepository)
const tableController = new TableController(tableService)

const router = Router({ mergeParams: true })

const staff = [authenticate, authorize(['admin', 'manager', 'camarero']), authorizeRestaurant]
const adminOnly = [authenticate, authorize(['admin'])]
const clientOnly = [authenticate, authorize(['cliente'])]

router.get('/available', ...clientOnly, tableController.getAvailable)
router.get('/', ...staff, tableController.getAll)
router.post('/', ...adminOnly, tableController.create)
router.get('/:id', ...staff, tableController.getById)
router.put('/:id', ...adminOnly, tableController.update)
router.delete('/:id', ...adminOnly, tableController.delete)
router.patch('/:id/status', ...staff, tableController.changeStatus)
router.post('/:id/occupy', ...clientOnly, tableController.occupy)

export default router
