import { ErrorRequestHandler } from 'express'

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    const statusCode = err.statusCode || 500

    console.error(err)

    res.status(statusCode).send({
        message:
            statusCode === 500
                ? 'На сервере произошла ошибка'
                : err.message,
    })
}

export default errorHandler
