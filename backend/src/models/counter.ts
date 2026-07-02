import mongoose, { Document } from 'mongoose'

interface ICounter extends Document {
    sequenceValue: number
}

const counterSchema = new mongoose.Schema<ICounter>({
    sequenceValue: {
        type: Number,
        required: true,
        default: 0,
    },
})

export default mongoose.model<ICounter>('counter', counterSchema)
