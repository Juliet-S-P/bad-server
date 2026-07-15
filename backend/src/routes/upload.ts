import { Router } from 'express'

import {
    uploadFile
} from '../controllers/upload'

import fileMiddleware from '../middlewares/file'

import {
    roleGuardMiddleware
} from '../middlewares/auth'

import {
    Role
} from '../models/user'
import { csrfProtection } from '../middlewares/csrf'


const uploadRouter = Router()


uploadRouter.post(
    '/',
    roleGuardMiddleware(Role.Admin),
    csrfProtection,
    fileMiddleware.single('file'),
    uploadFile
)


export default uploadRouter
