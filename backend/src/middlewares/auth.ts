import { NextFunction, Request, Response } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Model, Types } from 'mongoose'
import { ACCESS_TOKEN } from '../config'
import ForbiddenError from '../errors/forbidden-error'
import NotFoundError from '../errors/not-found-error'
import UnauthorizedError from '../errors/unauthorized-error'
import UserModel, { Role } from '../models/user'

const auth = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.header('Authorization')

    if (!authHeader?.startsWith('Bearer ')) {
        return next(new UnauthorizedError('Необходима авторизация'))
    }

    try {
        const token = authHeader.split(' ')[1]

        const payload = jwt.verify(token, ACCESS_TOKEN.secret, {
            algorithms: ['HS256'],
        }) as JwtPayload

        if (!payload?.sub || !Types.ObjectId.isValid(String(payload.sub))) {
            return next(new UnauthorizedError('Невалидный токен'))
        }

        const user = await UserModel.findById(payload.sub).select('-password -salt')

        if (!user) {
            return next(new UnauthorizedError('Пользователь не найден'))
        }

        res.locals.user = user
        return next()
    } catch (error) {
        if (error instanceof Error && error.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('Истек срок действия токена'))
        }

        return next(new UnauthorizedError('Необходима авторизация'))
    }
}

export function roleGuardMiddleware(...roles: Role[]) {
    return (_req: Request, res: Response, next: NextFunction) => {
        if (!res.locals.user) {
            return next(new UnauthorizedError('Необходима авторизация'))
        }

        const hasAccess = roles.some((role) =>
            res.locals.user.roles.includes(role)
        )

        if (!hasAccess) {
            return next(new ForbiddenError('Доступ запрещен'))
        }

        return next()
    }
}

export function currentUserAccessMiddleware<T>(
    model: Model<T>,
    idProperty: string,
    userProperty: keyof T
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const id = req.params[idProperty]

        if (!res.locals.user) {
            return next(new UnauthorizedError('Необходима авторизация'))
        }

        if (res.locals.user.roles.includes(Role.Admin)) {
            return next()
        }

        const entity = await model.findById(id)

        if (!entity) {
            return next(new NotFoundError('Не найдено'))
        }

        const ownerId = entity[userProperty] as Types.ObjectId

        const hasAccess = new Types.ObjectId(
            String(res.locals.user._id)
        ).equals(ownerId)

        if (!hasAccess) {
            return next(new ForbiddenError('Доступ запрещен'))
        }

        return next()
    }
}

export default auth
