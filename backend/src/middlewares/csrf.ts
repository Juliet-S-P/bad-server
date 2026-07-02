import crypto from 'crypto'
import { Request, Response, NextFunction } from 'express'

export const csrfTokenMiddleware = (_req: Request, res: Response, next: NextFunction) => {
    const token = crypto.randomBytes(32).toString('hex')

    res.cookie('csrfToken', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    })

    res.locals.csrfToken = token

    next()
}

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
    const cookieToken = req.cookies?.csrfToken
    const headerToken = req.headers['x-csrf-token']

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return res.status(403).json({
            message: 'CSRF validation failed',
        })
    }

    next()
}
