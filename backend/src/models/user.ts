import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import mongoose, { Document, HydratedDocument, Model, Types } from 'mongoose'

import validator from 'validator'
import sanitizeHtml from 'sanitize-html'

import { ACCESS_TOKEN, REFRESH_TOKEN } from '../config'

import UnauthorizedError from '../errors/unauthorized-error'

export enum Role {
    Customer = 'customer',
    Admin = 'admin',
}

export interface IUser extends Document {
    name: string

    email: string

    password: string

    tokens: {
        token: string
    }[]

    roles: Role[]

    phone: string

    totalAmount: number

    orderCount: number

    orders: Types.ObjectId[]

    lastOrderDate: Date | null

    lastOrder: Types.ObjectId | null
}

interface IUserMethods {
    generateAccessToken(): string

    generateRefreshToken(): Promise<string>

    calculateOrderStats(): Promise<void>
}

interface IUserModel extends Model<IUser, {}, IUserMethods> {
    findUserByCredentials(
        email: string,
        password: string
    ): Promise<HydratedDocument<IUser, IUserMethods>>
}

const userSchema = new mongoose.Schema<IUser, IUserModel, IUserMethods>(
    {
        name: {
            type: String,

            default: 'Евлампий',

            minlength: 2,

            maxlength: 30,

            set: (value: string) => sanitizeHtml(value),
        },

        email: {
            type: String,

            required: [true, 'Поле "email" должно быть заполнено'],

            unique: true,

            set: (value: string) => value.trim().toLowerCase(),

            validate: {
                validator: (v: string) => validator.isEmail(v),

                message: 'Поле "email" должно быть валидным email-адресом',
            },
        },

        password: {
            type: String,

            required: true,

            minlength: 6,

            select: false,
        },

        tokens: [
            {
                token: {
                    type: String,

                    required: true,
                },
            },
        ],

        roles: {
            type: [String],

            enum: Object.values(Role),

            default: [Role.Customer],
        },

        phone: {
            type: String,

            validate: {
    validator: (value: string) =>
        validator.isMobilePhone(value, 'any'),
    message: 'Некорректный номер телефона',
},
        },

        lastOrderDate: {
            type: Date,

            default: null,
        },

        lastOrder: {
            type: mongoose.Schema.Types.ObjectId,

            ref: 'order',

            default: null,
        },

        totalAmount: {
            type: Number,

            default: 0,
        },

        orderCount: {
            type: Number,

            default: 0,
        },

        orders: [
            {
                type: Types.ObjectId,

                ref: 'order',
            },
        ],
    },

    {
        versionKey: false,

        timestamps: true,

        toJSON: {
            virtuals: true,

            transform: (_doc, ret) => {
                const result = ret as Partial<IUser>

                delete result.password

                delete result.tokens

                delete result._id

                return result
            },
        },
    }
)

userSchema.pre(
    'save',

    async function (next) {
        if (this.isModified('password')) {
            const saltRounds = Number(process.env.BCRYPT_ROUNDS || 10)

            this.password = await bcrypt.hash(this.password, saltRounds)
        }

        next()
    }
)

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            email: this.email,

            _id: this._id.toString(),
        },

        ACCESS_TOKEN.secret,

        {
            expiresIn: ACCESS_TOKEN.expiry,

            subject: this._id.toString(),

            algorithm: 'HS256',
        }
    )
}

userSchema.methods.generateRefreshToken = async function () {
    const token = jwt.sign(
        {
            _id: this._id.toString(),
        },

        REFRESH_TOKEN.secret,

        {
            expiresIn: REFRESH_TOKEN.expiry,

            subject: this._id.toString(),

            algorithm: 'HS256',
        }
    )

    const hash = crypto
        .createHmac('sha256', REFRESH_TOKEN.secret)
        .update(token)
        .digest('hex')

    this.tokens.push({
        token: hash,
    })

    await this.save()

    return token
}

userSchema.methods.calculateOrderStats = async function () {
    const [stats] = await mongoose.model('order').aggregate([
        {
            $match: {
                customer: this._id,
            },
        },
        {
            $sort: {
                createdAt: -1,
            },
        },
        {
            $group: {
                _id: null,
                totalAmount: { $sum: '$totalAmount' },
                orderCount: { $sum: 1 },
                lastOrder: { $first: '$_id' },
                lastOrderDate: { $first: '$createdAt' },
            },
        },
    ])

    this.totalAmount = stats?.totalAmount ?? 0
    this.orderCount = stats?.orderCount ?? 0
    this.lastOrder = stats?.lastOrder ?? null
    this.lastOrderDate = stats?.lastOrderDate ?? null

    await this.save()
}


userSchema.statics.findUserByCredentials = async function (
    email: string,

    password: string
) {
    const user = await this.findOne({
        email: email.toLowerCase(),
    })

        .select('+password')

        .orFail(() => new UnauthorizedError('Неправильные почта или пароль'))

    const ok = await bcrypt.compare(
        password,

        user.password
    )

    if (!ok) {
        throw new UnauthorizedError('Неправильные почта или пароль')
    }

    return user
}

const UserModel = mongoose.model<IUser, IUserModel>(
    'user',

    userSchema
)

export default UserModel
