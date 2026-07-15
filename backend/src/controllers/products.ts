import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { Error as MongooseError } from 'mongoose'
import { basename, extname, join } from 'path'
import sanitizeHtml from 'sanitize-html'
import fs from 'fs/promises'

import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import Product from '../models/product'
import movingFile from '../utils/movingFile'

const MAX_LIMIT = 50
const MAX_TEXT_LENGTH = 1000
const CACHE_TTL_MS = 30_000
const MAX_CACHE_ENTRIES = 100

type ProductsResponse = {
    items: unknown[]
    pagination: {
        totalProducts: number
        totalPages: number
        currentPage: number
        pageSize: number
    }
}

const productsCache = new Map<
    string,
    { expiresAt: number; value: ProductsResponse }
>()

const clearProductsCache = () => productsCache.clear()

const sanitizeText = (value: unknown): unknown => {
    if (typeof value !== 'string') {
        return value
    }

    const limitedValue = value.length > MAX_TEXT_LENGTH 
        ? value.slice(0, MAX_TEXT_LENGTH) 
        : value

    return sanitizeHtml(limitedValue)
}

const safeFileName = (fileName: string): string => {
    const name = basename(fileName)
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp']

    const ext = extname(name).toLowerCase()
    if (!allowedExt.includes(ext)) {
        throw new BadRequestError('Недопустимый тип файла')
    }

    return name
}

/**
 * Проверяет MIME-тип файла по содержимому
 * Предварительно проверяет существование файла
 */
const validateFileMime = async (filePath: string): Promise<void> => {
    try {
        await fs.access(filePath)

        const file = await fs.open(filePath, 'r')
        const signature = Buffer.alloc(12)
        await file.read(signature, 0, signature.length, 0)
        await file.close()

        const isJpeg = signature.subarray(0, 3).equals(
            Buffer.from([0xff, 0xd8, 0xff])
        )
        const isPng = signature.subarray(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        )
        const isWebp =
            signature.subarray(0, 4).toString('ascii') === 'RIFF' &&
            signature.subarray(8, 12).toString('ascii') === 'WEBP'

        if (!isJpeg && !isPng && !isWebp) {
            throw new BadRequestError(
                'Недопустимый формат файла. Разрешены: jpg, png, webp'
            )
        }
    } catch (error) {
        if (error instanceof BadRequestError) {
            throw error
        }
        throw new BadRequestError('Файл не найден или повреждён')
    }
}

/**
 * Перемещает файл из временной папки в постоянную с проверкой безопасности
 * Возвращает имя файла или undefined, если файл не был передан
 */
const processUploadedFile = async (
    image?: { fileName?: string }
): Promise<string | undefined> => {
    if (!image?.fileName) {
        return undefined
    }

    const fileName = safeFileName(image.fileName)
    const tempDir = join(__dirname, `../public/${process.env.UPLOAD_PATH_TEMP}`)
    const targetDir = join(__dirname, `../public/${process.env.UPLOAD_PATH}`)

    // Проверяем MIME-тип перед перемещением
    await validateFileMime(join(tempDir, fileName))

    await movingFile(
        fileName,
        tempDir,
        targetDir
    )

    return fileName
}

const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const cacheKey = req.originalUrl
        const cached = productsCache.get(cacheKey)

        res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=30')

        if (cached && cached.expiresAt > Date.now()) {
            res.set('X-Cache', 'HIT')
            return res.status(200).send(cached.value)
        }

        if (cached) productsCache.delete(cacheKey)

        const pageRaw = req.query.page
        const limitRaw = req.query.limit

        const page = Number.isFinite(Number(pageRaw))
            ? Math.max(Number(pageRaw), 1)
            : 1

        const limit = Number.isFinite(Number(limitRaw))
            ? Math.min(Math.max(Number(limitRaw), 1), MAX_LIMIT)
            : 5

        const options = {
            skip: (page - 1) * limit,
            limit,
        }

        const products = await Product.find({}, null, options)
        const totalProducts = await Product.countDocuments({})
        const totalPages = Math.ceil(totalProducts / limit)

        const response: ProductsResponse = {
            items: products,
            pagination: {
                totalProducts,
                totalPages,
                currentPage: page,
                pageSize: limit,
            },
        }

        if (productsCache.size >= MAX_CACHE_ENTRIES) {
            const oldestKey = productsCache.keys().next().value
            if (oldestKey) productsCache.delete(oldestKey)
        }

        productsCache.set(cacheKey, {
            expiresAt: Date.now() + CACHE_TTL_MS,
            value: response,
        })
        res.set('X-Cache', 'MISS')

        return res.status(200).send(response)
    } catch (err) {
        return next(err)
    }
}

const createProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        let { description, category, price, title } = req.body
        const { image } = req.body

        description = sanitizeText(description)
        category = sanitizeText(category)
        title = sanitizeText(title)

        if (!Number.isFinite(Number(price))) {
            throw new BadRequestError('Некорректная цена')
        }
        price = Number(price)

        const fileName = await processUploadedFile(image)

        const product = await Product.create({
            description,
            image: fileName
                ? {
                    ...image,
                    fileName,
                }
                : image,
            category,
            price,
            title,
        })

        clearProductsCache()

        return res.status(constants.HTTP_STATUS_CREATED).send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

const updateProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params

        if (!productId || typeof productId !== 'string') {
            return next(new BadRequestError('Некорректный ID'))
        }

        const { description, category, price, title, image } = req.body

        const updateData: Partial<{
            title: string
            description: string
            category: string
            price: number
            image: Record<string, unknown>
        }> = {}

        if (title !== undefined) {
            updateData.title = sanitizeText(title) as string
        }
        if (description !== undefined) {
            updateData.description = sanitizeText(description) as string
        }
        if (category !== undefined) {
            updateData.category = sanitizeText(category) as string
        }
        if (price !== undefined) {
            if (!Number.isFinite(Number(price))) {
                throw new BadRequestError('Некорректная цена')
            }
            updateData.price = Number(price)
        }

        if (image?.fileName) {
            const fileName = await processUploadedFile(image)
            updateData.image = {
                ...image,
                fileName,
            }
        }

        const product = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData },
            { runValidators: true, new: true }
        ).orFail(() => new NotFoundError('Нет товара по заданному id'))

        clearProductsCache()

        return res.status(200).send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(
                new ConflictError('Товар с таким заголовком уже существует')
            )
        }
        return next(error)
    }
}

const deleteProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params

        if (!productId || typeof productId !== 'string') {
            return next(new BadRequestError('Некорректный ID'))
        }

        const product = await Product.findByIdAndDelete(productId).orFail(
            () => new NotFoundError('Нет товара по заданному id')
        )

        clearProductsCache()

        return res.status(200).send(product)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        return next(error)
    }
}

export { createProduct, deleteProduct, getProducts, updateProduct }
