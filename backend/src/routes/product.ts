import { Router } from 'express'

import {
    createProduct,
    deleteProduct,
    getProducts,
    updateProduct,
} from '../controllers/products'

import auth, { roleGuardMiddleware } from '../middlewares/auth'

import {
    validateObjId,
    validateProductBody,
    validateProductUpdateBody,
} from '../middlewares/validations'

import {
    csrfProtection,
} from '../middlewares/csrf'

import {
    Role,
} from '../models/user'


const productRouter = Router()


productRouter.get(
    '/',
    getProducts
)


productRouter.post(
    '/',
    auth,
    roleGuardMiddleware(Role.Admin),
    csrfProtection,
    validateProductBody,
    createProduct
)


productRouter.patch(
    '/:productId',
    auth,
    roleGuardMiddleware(Role.Admin),
    csrfProtection,
    validateObjId,
    validateProductUpdateBody,
    updateProduct
)


productRouter.delete(
    '/:productId',
    auth,
    roleGuardMiddleware(Role.Admin),
    csrfProtection,
    validateObjId,
    deleteProduct
)


export default productRouter
