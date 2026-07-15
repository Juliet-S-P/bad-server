import crypto from 'crypto'
import { NextFunction, Request, Response } from 'express'

const CSRF_COOKIE_NAME = '_csrf'

export const csrfTokenMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let token = req.cookies?.[CSRF_COOKIE_NAME]

    if (!token) {
        token = crypto.randomBytes(32).toString('hex')

        res.cookie(CSRF_COOKIE_NAME, token, {
            httpOnly: false,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
        })
    }

    res.locals.csrfToken = token

    next()
}

export const csrfProtection = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME]
    const headerToken = req.header('x-csrf-token')

    const tokensAreValid =
        typeof cookieToken === 'string' &&
        typeof headerToken === 'string' &&
        cookieToken.length === 64 &&
        headerToken.length === 64 &&
        /^[a-f0-9]{64}$/i.test(cookieToken) &&
        /^[a-f0-9]{64}$/i.test(headerToken) &&
        crypto.timingSafeEqual(
            Buffer.from(cookieToken, 'hex'),
            Buffer.from(headerToken, 'hex')
        )

    if (!tokensAreValid) {
        return res.status(403).json({
            message: 'CSRF validation failed',
        })
    }

    next()
}
