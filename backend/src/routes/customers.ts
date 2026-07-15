import { Router } from 'express'
import { csrfProtection } from '../middlewares/csrf'
import {
    deleteCustomer,
    getCustomerById,
    getCustomers,
    updateCustomer,
} from '../controllers/customers'

import  {
    roleGuardMiddleware,
} from '../middlewares/auth'

import {
    validateObjId
} from '../middlewares/validations'

import { Role } from '../models/user'


const customerRouter = Router()


customerRouter.get(
    '/',
    roleGuardMiddleware(Role.Admin),
    getCustomers
)


customerRouter.get(
    '/:id',
    roleGuardMiddleware(Role.Admin),
    validateObjId,
    getCustomerById
)


customerRouter.patch(
    '/:id',
    roleGuardMiddleware(Role.Admin),
    csrfProtection,
    validateObjId,
    updateCustomer
)


customerRouter.delete(
    '/:id',
    roleGuardMiddleware(Role.Admin),
    csrfProtection,
    validateObjId,
    deleteCustomer
)


export default customerRouter
