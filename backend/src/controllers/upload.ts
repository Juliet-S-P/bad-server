import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import path from 'path'
import sanitizeHtml from 'sanitize-html'
import { open, unlink } from 'fs/promises'

import BadRequestError from '../errors/bad-request-error'

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_FILENAME_LENGTH = 120
const MIN_FILE_SIZE = 2 * 1024

const hasAllowedImageSignature = async (filePath: string) => {
    const file = await open(filePath, 'r')
    try {
        const signature = Buffer.alloc(12)
        await file.read(signature, 0, signature.length, 0)

        const isJpeg = signature.subarray(0, 3).equals(
            Buffer.from([0xff, 0xd8, 0xff])
        )
        const isPng = signature.subarray(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        )
        const isWebp =
            signature.subarray(0, 4).toString('ascii') === 'RIFF' &&
            signature.subarray(8, 12).toString('ascii') === 'WEBP'

        return isJpeg || isPng || isWebp
    } finally {
        await file.close()
    }
}

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
        if (req.file.size <= MIN_FILE_SIZE) {
            await unlink(req.file.path)
            throw new BadRequestError('Файл должен быть больше 2 КБ')
        }

        if (!(await hasAllowedImageSignature(req.file.path))) {
            await unlink(req.file.path)
            throw new BadRequestError('Содержимое файла не является изображением')
        }

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
