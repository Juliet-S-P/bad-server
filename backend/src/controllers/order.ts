import sanitizeHtml from 'sanitize-html'
import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Error as MongooseError, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { IOrder } from '../models/order'
import Product, { IProduct } from '../models/product'
import User from '../models/user'
import escapeRegExp from '../utils/escapeRegExp'

export const getOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortField = 'createdAt',
            sortOrder = 'desc',
            status,
            totalAmountFrom,
            totalAmountTo,
            orderDateFrom,
            orderDateTo,
            search,
        } = req.query

        const filters: FilterQuery<Partial<IOrder>> = {}
        if (typeof status === 'string') {
            filters.status = status
        }

        if (totalAmountFrom || totalAmountTo) {
            filters.totalAmount = {}
            if (totalAmountFrom) {
                filters.totalAmount.$gte = Number(totalAmountFrom)
            }
            if (totalAmountTo) {
                filters.totalAmount.$lte = Number(totalAmountTo)
            }
        }

        if (orderDateFrom || orderDateTo) {
            filters.createdAt = {}
            if (orderDateFrom) {
                filters.createdAt.$gte = new Date(orderDateFrom as string)
            }
            if (orderDateTo) {
                filters.createdAt.$lte = new Date(orderDateTo as string)
            }
        }

        const aggregatePipeline: any[] = [
            { $match: filters },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products',
                    foreignField: '_id',
                    as: 'products',
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            { $unwind: '$customer' },
            { $unwind: '$products' },
        ]

        if (search) {
            const safeSearch = escapeRegExp(String(search).slice(0, 100))
            const searchRegex = new RegExp(safeSearch, 'i')
            const searchNumber = Number(search)

            const searchConditions: any[] = [
                { 'products.title': searchRegex },
            ]

            if (!Number.isNaN(searchNumber)) {
                searchConditions.push({ orderNumber: searchNumber })
            }

            aggregatePipeline.push({
                $match: {
                    $or: searchConditions,
                },
            })
        }

        const sort: Record<string, 1 | -1> = {}
        sort[sortField as string] = sortOrder === 'desc' ? -1 : 1

        aggregatePipeline.push(
            { $sort: sort },
            { $skip: (Number(page) - 1) * Number(limit) },
            { $limit: Number(limit) },
            {
                $group: {
                    _id: '$_id',
                    orderNumber: { $first: '$orderNumber' },
                    status: { $first: '$status' },
                    totalAmount: { $first: '$totalAmount' },
                    products: { $push: '$products' },
                    customer: { $first: '$customer' },
                    createdAt: { $first: '$createdAt' },
                },
            }
        )

        const orders = await Order.aggregate(aggregatePipeline)
        const totalOrders = await Order.countDocuments(filters)

        res.status(200).json({
            orders,
            pagination: {
                totalOrders,
                totalPages: Math.ceil(totalOrders / Number(limit)),
                currentPage: Number(page),
                pageSize: Number(limit),
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getOrdersCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const { search, page = 1, limit = 5 } = req.query

        const user = await User.findById(userId)
            .populate({
                path: 'orders',
                populate: [
                    { path: 'products' },
                    { path: 'customer' },
                ],
            })
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )

        let orders = user.orders as unknown as IOrder[]

        if (search) {
            const safeSearch = escapeRegExp(String(search).slice(0, 100))
            const searchRegex = new RegExp(safeSearch, 'i')
            const searchNumber = Number(search)

            const products = await Product.find({ title: searchRegex })
            const productIds = products.map((p) => p._id)

            orders = orders.filter((order) => {
                const matchesProduct = order.products.some((product: any) =>
                    productIds.some((id) => id.equals(product._id))
                )

                const matchesNumber =
                    !Number.isNaN(searchNumber) &&
                    order.orderNumber === searchNumber

                return matchesProduct || matchesNumber
            })
        }

        const totalOrders = orders.length
        const totalPages = Math.ceil(totalOrders / Number(limit))

        const skip = (Number(page) - 1) * Number(limit)
        orders = orders.slice(skip, skip + Number(limit))

        res.send({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: Number(page),
                pageSize: Number(limit),
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(() => new NotFoundError('Заказ не найден'))

        res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Некорректный ID заказа'))
        }
        next(error)
    }
}

export const getOrderCurrentUserByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id

        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )

        if (!order.customer._id.equals(userId)) {
            return next(
                new NotFoundError(
                    'Заказ по заданному id отсутствует в базе'
                )
            )
        }

        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(
                new BadRequestError(
                    'Некорректный ID заказа'
                )
            )
        }

        next(error)
    }
}

export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            items,
            payment,
            phone,
            total,
            email,
            address,
            comment,
        } = req.body

        const userId = res.locals.user._id

        if (!Array.isArray(items)) {
            return next(new BadRequestError('Invalid items'))
        }

        if (typeof total !== 'number') {
            return next(new BadRequestError('Invalid total'))
        }

        const safeComment = sanitizeHtml(comment || '')
        const safeEmail = sanitizeHtml(email || '')
        const safePhone = sanitizeHtml(phone || '')
        const safeAddress = sanitizeHtml(address || '')

        const products = await Product.find({})
        const basket: IProduct[] = []

        const invalidId = items.find(
            (id: string) => !Types.ObjectId.isValid(id)
        )

        if (invalidId) {
            return next(
                new BadRequestError(
                    `Некорректный id товара ${invalidId}`
                )
            )
        }

        items.forEach((id: string) => {
            const product = products.find((p) =>
                p._id.equals(id)
            )

            if (!product) {
                throw new BadRequestError(
                    `Товар с id ${id} не найден`
                )
            }

            if (product.price === null) {
                throw new BadRequestError(
                    `Товар ${id} не продаётся`
                )
            }

            basket.push(product)
        })

        const calculatedTotal = basket.reduce(
            (sum, p) => sum + p.price,
            0
        )

        const newOrder = new Order({
            totalAmount: calculatedTotal,
            products: items,
            payment,
            phone: safePhone,
            email: safeEmail,
            comment: safeComment,
            customer: userId,
            deliveryAddress: safeAddress,
        })

        await newOrder.save()

        const populated = await newOrder.populate([
            'customer',
            'products',
        ])

        res.status(200).json(populated)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof BadRequestError) {
            return next(error)
        }
        next(error)
    }
}

export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } = req.body

        if (typeof status !== 'string') {
            return next(new BadRequestError('Invalid status'))
        }

        const updated = await Order.findOneAndUpdate(
            { orderNumber: req.params.orderNumber },
            { status },
            { new: true, runValidators: true }
        )
            .populate(['customer', 'products'])
            .orFail(() => new NotFoundError('Заказ не найден'))

        res.status(200).json(updated)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        next(error)
    }
}

export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deleted = await Order.findByIdAndDelete(req.params.id)
            .populate(['customer', 'products'])
            .orFail(() => new NotFoundError('Заказ не найден'))

        res.status(200).json(deleted)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Некорректный ID'))
        }
        next(error)
    }
}
