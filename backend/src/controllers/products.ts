import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { Error as MongooseError } from 'mongoose'
import path, { join, basename, extname } from 'path'
import sanitizeHtml from 'sanitize-html'

import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import Product from '../models/product'
import movingFile from '../utils/movingFile'

const MAX_LIMIT = 50
const MAX_TEXT_LENGTH = 1000

const sanitizeText = (value: unknown) => {
    if (typeof value !== 'string') {
        return value
    }

    const limitedValue = value.length > MAX_TEXT_LENGTH 
        ? value.slice(0, MAX_TEXT_LENGTH) 
        : value

    return sanitizeHtml(limitedValue)
}

const safeFileName = (fileName: string) => {
    const name = basename(fileName)
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp']

    const ext = extname(name).toLowerCase()
    if (!allowedExt.includes(ext)) {
        throw new BadRequestError('Недопустимый тип файла')
    }

    return name
}

const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const pageRaw = req.query.page
const limitRaw = req.query.limit

const page = Number.isFinite(Number(pageRaw))
    ? Math.max(Number(pageRaw), 1)
    : 1

const limit = Number.isFinite(Number(limitRaw))
    ? Math.min(Number(limitRaw), MAX_LIMIT)
    : 5

        const options = {
            skip: (page - 1) * limit,
            limit,
        }

        const products = await Product.find({}, null, options)

        const totalProducts = await Product.countDocuments({})
        const totalPages = Math.ceil(totalProducts / limit)

    return res.status(200).send({
    items: products,
    pagination: {
        totalProducts,
        totalPages,
        currentPage: page,
        pageSize: limit,
    },
})
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

        if (image?.fileName) {
            const fileName = safeFileName(path.basename(image.fileName))

            movingFile(
                fileName,
                join(__dirname, `../public/${process.env.UPLOAD_PATH_TEMP}`),
                join(__dirname, `../public/${process.env.UPLOAD_PATH}`)
            )

            image.fileName = fileName
        }

        const product = await Product.create({
            description,
            image,
            category,
            price,
            title,
        })

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

        if (typeof productId !== 'string') {
            return next(new BadRequestError('Некорректный ID'))
        }

        const { image } = req.body

        if (image?.fileName) {
            const fileName = safeFileName(image.fileName)

            movingFile(
                fileName,
                join(__dirname, `../public/${process.env.UPLOAD_PATH_TEMP}`),
                join(__dirname, `../public/${process.env.UPLOAD_PATH}`)
            )
           const updatedImage = {
    ...image,
    fileName,
}
            
            const product = await Product.findByIdAndUpdate(
                productId,
                {
                    $set: {
                        ...req.body,
                        price: req.body.price ? Number(req.body.price) : null,
                        image: updatedImage ?? undefined,
                        title: sanitizeText(req.body.title),
                        description: sanitizeText(req.body.description),
                        category: sanitizeText(req.body.category),
                    },
                },
                { runValidators: true, new: true }
            ).orFail(() => new NotFoundError('Нет товара по заданному id'))

            return res.status(200).send(product)
        }

        const product = await Product.findByIdAndUpdate(
            productId,
            {
                $set: {
                    ...req.body,
                    price: req.body.price ? Number(req.body.price) : null,
                    title: sanitizeText(req.body.title),
                    description: sanitizeText(req.body.description),
                    category: sanitizeText(req.body.category),
                },
            },
            { runValidators: true, new: true }
        ).orFail(() => new NotFoundError('Нет товара по заданному id'))

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

        if (typeof productId !== 'string') {
            return next(new BadRequestError('Некорректный ID'))
        }

        const product = await Product.findByIdAndDelete(productId).orFail(
            () => new NotFoundError('Нет товара по заданному id')
        )

        return res.status(200).send(product)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID товара'))
        }
        return next(error)
    }
}

export { createProduct, deleteProduct, getProducts, updateProduct }
