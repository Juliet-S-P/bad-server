import { Router } from 'express'
import { csrfProtection } from '../middlewares/csrf'
import {
    createOrder,
    deleteOrder,
    getOrderByNumber,
    getOrderCurrentUserByNumber,
    getOrders,
    getOrdersCurrentUser,
    updateOrder,
} from '../controllers/order'

import {
    roleGuardMiddleware,
} from '../middlewares/auth'

import {
    validateOrderBody,
} from '../middlewares/validations'

import {
    Role,
} from '../models/user'


const orderRouter = Router()

orderRouter.post(
    '/',
    csrfProtection,
    validateOrderBody,
    createOrder
)

orderRouter.get(
    '/all',
    roleGuardMiddleware(Role.Admin),
    getOrders
)

orderRouter.get(
    '/all/me',
    getOrdersCurrentUser
)

orderRouter.get(
    '/:orderNumber',
    roleGuardMiddleware(Role.Admin),
    getOrderByNumber
)

orderRouter.get(
    '/me/:orderNumber',
    getOrderCurrentUserByNumber
)

orderRouter.patch(
    '/:orderNumber',
    csrfProtection,
    roleGuardMiddleware(Role.Admin),
    updateOrder
)

orderRouter.delete(
    '/:id',
    csrfProtection,
    roleGuardMiddleware(Role.Admin),
    deleteOrder
)


export default orderRouter
