import { mkdir, access, rename } from 'fs/promises'
import { basename, join } from 'path'


async function movingFile(
    imagePath: string,
    from: string,
    to: string
) {
    const fileName = basename(imagePath)

    const imagePathTemp = join(from, fileName)
    const imagePathPermanent = join(to, fileName)

    await mkdir(to, {
        recursive: true,
    })

    try {
        await access(imagePathTemp)
    } catch {
        throw new Error(
            'Ошибка при сохранении файла'
        )
    }

    await rename(
        imagePathTemp,
        imagePathPermanent
    )
}

export default movingFile
