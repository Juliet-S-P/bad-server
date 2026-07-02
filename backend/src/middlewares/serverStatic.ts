import { NextFunction, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export default function serveStatic(baseDir: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const decodedPath = decodeURIComponent(req.path)

            const safePath = path
                .normalize(decodedPath)
                .replace(/^(\.\.(\/|\\|$))+/, '')

            const filePath = path.join(baseDir, safePath)

            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) return next()

                res.sendFile(filePath, (sendErr) => {
                    if (sendErr) return next(sendErr)
                })
            })
        } catch (e) {
            next(e)
        }
    }
}
