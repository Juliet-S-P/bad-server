import { unlink } from 'fs'
import mongoose, { Document } from 'mongoose'
import { join, basename } from 'path'
import sanitizeHtml from 'sanitize-html'

export interface IFile {
    fileName: string
    originalName: string
}

export interface IProduct extends Document {
    title: string
    image: IFile
    category: string
    description: string
    price: number
}

const cardsSchema = new mongoose.Schema<IProduct>(
    {
        title: {
            type: String,
            unique: true,

            required: [
                true,
                'Поле "title" должно быть заполнено',
            ],

            minlength: [
                2,
                'Минимальная длина поля "title" - 2',
            ],

            maxlength: [
                30,
                'Максимальная длина поля "title" - 30',
            ],

            set: (value: string) =>
                sanitizeHtml(value),
        },


        image: {
            fileName: {
                type: String,

                required: [
                    true,
                    'Поле "image.fileName" должно быть заполнено',
                ],

                set: (value: string) =>
                    basename(value),
            },


            originalName: {
                type: String,

                set: (value: string) =>
                    sanitizeHtml(value),
            },
        },


        category: {
            type: String,

            required: [
                true,
                'Поле "category" должно быть заполнено',
            ],

            set: (value: string) =>
                sanitizeHtml(value),
        },


        description: {
            type: String,

            set: (value: string) =>
                sanitizeHtml(value),
        },


        price: {
            type: Number,
            default: null,
        },
    },

    {
        versionKey: false,
    }
)


cardsSchema.index({ title: 'text' })

cardsSchema.pre(
    'findOneAndUpdate',
    async function deleteOldImage() {

        // @ts-ignore
        const updateImage = this.getUpdate()?.$set?.image


        const docToUpdate =
            await this.model.findOne(this.getQuery())


        if (
            updateImage &&
            docToUpdate?.image?.fileName
        ) {

            const safeFileName =
                basename(docToUpdate.image.fileName)


            unlink(
                join(
                    __dirname,
                    `../public/${safeFileName}`
                ),

                (err) => {
                    if (err) {
                        console.log(err)
                    }
                }
            )
        }
    }
)

cardsSchema.post(
    'findOneAndDelete',
    async (doc: IProduct) => {


        if (!doc?.image?.fileName) {
            return
        }


        const safeFileName =
            basename(doc.image.fileName)


        unlink(
            join(
                __dirname,
                `../public/${safeFileName}`
            ),

            (err) => {
                if (err) {
                    console.log(err)
                }
            }
        )
    }
)


export default mongoose.model<IProduct>(
    'product',
    cardsSchema
)
