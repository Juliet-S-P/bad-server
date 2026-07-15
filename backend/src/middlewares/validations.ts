import { Joi, celebrate } from 'celebrate'

export const phoneRegExp = /^\+?[0-9][0-9\s()-]{6,19}$/

export enum PaymentType {
    Card = 'card',
    Online = 'online',
}
export const objectIdPattern = /^[a-fA-F0-9]{24}$/
export const validateOrderBody = celebrate({
    body: Joi.object().keys({
        items: Joi.array()
            .items(
                Joi.string()
                    .pattern(objectIdPattern)
                    .required()
                    .messages({
                        'string.pattern.base': 'Невалидный id товара',
                        'any.required': 'ID товара обязателен',
                    })
            )
            .min(1)
            .max(100)
            .required()
            .messages({
                'array.base': 'items должны быть массивом',
                'array.empty': 'Не указаны товары',
                'any.required': 'Не указаны товары',
            }),

        payment: Joi.string()
            .valid(...Object.values(PaymentType))
            .required()
            .messages({
                'any.only':
                    'Указано невалидное значение оплаты (card или online)',
                'any.required': 'Не указан способ оплаты',
                'string.empty': 'Не указан способ оплаты',
            }),

        email: Joi.string()
            .email()
            .max(254)
            .required()
            .messages({
                'string.email': 'Невалидный email',
                'any.required': 'Не указан email',
                'string.empty': 'Не указан email',
            }),

        phone: Joi.string()
            .max(20)
            .pattern(phoneRegExp)
            .required()
            .messages({
                'string.pattern.base': 'Невалидный телефон',
                'any.required': 'Не указан телефон',
                'string.empty': 'Не указан телефон',
            }),

        address: Joi.string()
            .max(500)
            .required()
            .messages({
                'any.required': 'Не указан адрес',
                'string.empty': 'Не указан адрес',
            }),

        total: Joi.number()
            .required()
            .messages({
                'any.required': 'Не указана сумма заказа',
                'number.base': 'Сумма должна быть числом',
            }),

        comment: Joi.string()
            .max(5000)
            .allow('')
            .optional(),
    }).unknown(false),
})

export const validateProductBody = celebrate({
    body: Joi.object().keys({
        title: Joi.string()
            .min(2)
            .max(30)
            .required()
            .messages({
                'string.min': 'Минимальная длина - 2',
                'string.max': 'Максимальная длина - 30',
                'string.empty': 'Название обязательно',
                'any.required': 'Название обязательно',
            }),

        image: Joi.object()
            .keys({
                fileName: Joi.string().required(),
                originalName: Joi.string().required(),
            })
            .required()
            .messages({
                'any.required': 'Изображение обязательно',
            }),

        category: Joi.string()
            .max(100)
            .required()
            .messages({
                'string.empty': 'Категория обязательна',
                'any.required': 'Категория обязательна',
            }),

        description: Joi.string()
            .max(1000)
            .required()
            .messages({
                'string.empty': 'Описание обязательно',
                'any.required': 'Описание обязательно',
            }),

        price: Joi.number().allow(null),
    }).unknown(false),
})

export const validateProductUpdateBody = celebrate({
    body: Joi.object().keys({
        title: Joi.string()
            .min(2)
            .max(30)
            .messages({
                'string.min': 'Минимальная длина - 2',
                'string.max': 'Максимальная длина - 30',
            }),

        image: Joi.object().keys({
            fileName: Joi.string().required(),
            originalName: Joi.string().required(),
        }),

        category: Joi.string().max(100),

        description: Joi.string().max(1000),

        price: Joi.number().allow(null),
    }).unknown(false),
})

export const validateObjId = celebrate({
    params: Joi.object()
        .keys({
            id: Joi.string().pattern(objectIdPattern),
            productId: Joi.string().pattern(objectIdPattern),
        })
        .or('id', 'productId')
        .messages({
            'string.pattern.base': 'Невалидный id',
            'object.missing': 'ID обязателен',
        }),
})

export const validateUserBody = celebrate({
    body: Joi.object()
        .keys({
            name: Joi.string()
                .min(2)
                .max(30)
                .messages({
                    'string.min': 'Минимум 2 символа',
                    'string.max': 'Максимум 30 символов',
                }),

            password: Joi.string()
                .min(6)
                .max(128)
                .messages({
                    'string.min': 'Минимум 6 символов',
                }),

            email: Joi.string()
                .email()
                .max(254)
                .messages({
                    'string.email': 'Некорректный email',
                }),
        })
        .unknown(false),
})

export const validateAuthentication = celebrate({
    body: Joi.object().keys({
        email: Joi.string()
            .email()
            .max(254)
            .required()
            .messages({
                'string.email': 'Некорректный email',
                'any.required': 'Email обязателен',
            }),

        password: Joi.string()
            .max(128)
            .required()
            .messages({
                'any.required': 'Пароль обязателен',
                'string.empty': 'Пароль обязателен',
            }),
    }).unknown(false),
})
