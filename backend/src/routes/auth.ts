import { Router } from 'express'

import { csrfProtection } from '../middlewares/csrf'

import auth from '../middlewares/auth'

import {
    getCurrentUser,
    getCurrentUserRoles,
    login,
    logout,
    refreshAccessToken,
    register,
    updateCurrentUser,
} from '../controllers/auth'

import {
    validateAuthentication,
    validateUserBody,
} from '../middlewares/validations'


const authRouter = Router()


authRouter.get(
    '/user',
    auth,
    getCurrentUser
)


authRouter.patch(
    '/me',
    auth,
    csrfProtection,
    validateUserBody,
    updateCurrentUser
)


authRouter.get(
    '/user/roles',
    auth,
    getCurrentUserRoles
)


authRouter.post(
    '/login',
    csrfProtection,
    validateAuthentication,
    login
)


authRouter.post(
    '/token',
    csrfProtection,
    refreshAccessToken
)


authRouter.post(
    '/logout',
    csrfProtection,
    logout
)


authRouter.post(
    '/register',
    csrfProtection,
    validateUserBody,
    register
)


export default authRouter
