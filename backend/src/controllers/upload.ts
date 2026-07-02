import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import path from 'path'
import sanitizeHtml from 'sanitize-html'

import BadRequestError from '../errors/bad-request-error'

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_FILENAME_LENGTH = 120

const sanitizeFileName = (name: string) => {
    const base = path.basename(name)

    if (base.includes('\0')) {
        throw new BadRequestError('Недопустимое имя файла')
    }

    if (base.length > MAX_FILENAME_LENGTH) {
        throw new BadRequestError('Слишком длинное имя файла')
    }

    const ext = path.extname(base).toLowerCase()

    if (!ALLOWED_EXT.includes(ext)) {
        throw new BadRequestError('Недопустимый тип файла')
    }

    return base
}

const sanitizeOriginalName = (name: string) =>
    sanitizeHtml(name, {
        allowedTags: [],
        allowedAttributes: {},
    }).slice(0, 120)

export const uploadFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.file) {
        return next(new BadRequestError('Файл не загружен'))
    }

    try {
        const safeFileName = sanitizeFileName(req.file.filename)

        const fileName = process.env.UPLOAD_PATH
            ? `/${process.env.UPLOAD_PATH}/${safeFileName}`
            : `/${safeFileName}`

        return res.status(constants.HTTP_STATUS_CREATED).send({
            fileName,
            originalName: sanitizeOriginalName(req.file.originalname),
        })
    } catch (error) {
        return next(error)
    }
}

export default {}
