import { Router } from 'express'
import { csrfTokenMiddleware } from '../middlewares/csrf'
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

authRouter.get('/csrf', csrfTokenMiddleware, (_req, res) => {
    res.json({ csrfToken: res.locals.csrfToken })
})

authRouter.get(
    '/user',
    getCurrentUser
)


authRouter.patch(
    '/me',
    validateUserBody,
    updateCurrentUser
)


authRouter.get(
    '/user/roles',
    getCurrentUserRoles
)


authRouter.post(
    '/login',
    validateAuthentication,
    login
)


authRouter.post(
    '/token',
    refreshAccessToken
)


authRouter.post(
    '/logout',
    logout
)


authRouter.post(
    '/register',
    validateUserBody,
    register
)


export default authRouter
