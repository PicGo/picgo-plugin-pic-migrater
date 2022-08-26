import sizeOf from 'image-size'
import { IImgSize } from 'picgo'

interface IImgSizeInfo extends IImgSize {
  type?: string
}

export const getImageSize = (buffer: Buffer): IImgSizeInfo => {
  try {
    const size = sizeOf(buffer)
    return {
      real: true,
      width: size.width,
      height: size.height,
      type: size.type
    }
  } catch (e) {
    // fallback to default size
    return {
      real: false,
      width: 200,
      height: 200,
      type: '.png'
    }
  }
}
