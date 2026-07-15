import { CookieOptions } from 'express'
import ms from 'ms'
import crypto from 'crypto'

function requireEnv(name: string): string {
    const value = process.env[name]

    if (!value) {
        throw new Error(`${name} is required`)
    }

    return value
}

function getSecret(name: string): string {
    const value = process.env[name]
    if (value) return value

    if (process.env.NODE_ENV === 'production') {
        return requireEnv(name)
    }

    return crypto.randomBytes(64).toString('hex')
}

export const { PORT = '3000' } = process.env
export const { DB_ADDRESS = 'mongodb://127.0.0.1:27017/weblarek' } = process.env
export const ORIGIN_ALLOW = process.env.ORIGIN_ALLOW || 'http://localhost:3000'
export const ACCESS_TOKEN = {
    secret: getSecret('AUTH_ACCESS_TOKEN_SECRET'),

    expiry:
        process.env.AUTH_ACCESS_TOKEN_EXPIRY || '10m',
}


export const REFRESH_TOKEN = {
    secret: getSecret('AUTH_REFRESH_TOKEN_SECRET'),
    expiry: process.env.AUTH_REFRESH_TOKEN_EXPIRY || '7d',
    cookie: {
        name: 'refreshToken',
        options: {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: ms(process.env.AUTH_REFRESH_TOKEN_EXPIRY || '7d'),
            path: '/',
        } as CookieOptions,
    },
}
