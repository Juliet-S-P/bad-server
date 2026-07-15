import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'
import express, { json, urlencoded } from 'express'

import mongoose from 'mongoose'
import path from 'path'
import { DB_ADDRESS, ORIGIN_ALLOW } from './config'
import errorHandler from './middlewares/error-handler'
import { csrfTokenMiddleware } from './middlewares/csrf'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'

const { PORT = 3000 } = process.env
const app = express()
const csrfTokenPaths = ['/auth/csrf-token', '/auth/csrf']
app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(helmet())

const csrfTokenLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
})

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Слишком много запросов, попробуйте позже',
    },
})

app.use(cookieParser())

app.use(
    cors({
        origin: ORIGIN_ALLOW,
        credentials: true,
    })
)

app.get(
    csrfTokenPaths,
    csrfTokenLimiter,
    csrfTokenMiddleware,
    (_req, res) => {
        res.json({
            csrfToken: res.locals.csrfToken,
        })
    }
)

app.use(limiter)

app.use(serveStatic(path.join(__dirname, 'public')))

app.use(
    urlencoded({
        extended: true,
        limit: '100kb',
    })
)

app.use(
    json({
        limit: '100kb',
    })
)

app.use(mongoSanitize())

app.options(
    '*',
    cors({
        origin: ORIGIN_ALLOW,
        credentials: true,
    })
)

app.use(routes)
app.use(errors())
app.use(errorHandler)

const bootstrap = async () => {
    try {
        await mongoose.connect(DB_ADDRESS)
        await app.listen(PORT, () => console.log('ok'))
    } catch (error) {
        console.error(error)
    }
}

bootstrap()
