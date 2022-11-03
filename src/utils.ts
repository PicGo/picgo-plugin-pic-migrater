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

export const isUrl = (url: string): boolean => (url.startsWith('http://') || url.startsWith('https://'))
export const isUrlEncode = (url: string): boolean => {
  url = url || ''
  try {
    // the whole url encode or decode shold not use encodeURIComponent or decodeURIComponent
    return url !== decodeURI(url)
  } catch (e) {
    // if some error caught, try to let it go
    return true
  }
}
export const handleUrlEncode = (url: string): string => {
  if (!isUrlEncode(url)) {
    url = encodeURI(url)
  }
  return url
}
