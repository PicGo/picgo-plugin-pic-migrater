/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable no-async-promise-executor */
import fs from 'fs'
import path from 'path'
import { IImgInfo, PicGo } from 'picgo'
import { getImageSize } from '../utils'

class Migrater {
  ctx: PicGo
  guiApi: any
  urlArray: string[]
  baseDir: string
  constructor (ctx: PicGo, guiApi: any, filePath: string) {
    this.guiApi = guiApi
    this.ctx = ctx
    this.baseDir = path.dirname(filePath)
  }

  init (urlList: IStringKeyMap): void {
    this.urlArray = Object.keys(urlList)
  }

  async migrate (): Promise<IMigrateResult> {
    const originTransformer = this.ctx.getConfig('picBed.transformer')
    this.ctx.setConfig({
      'picBed.transformer': 'base64'
    })
    this.ctx.output = [] // a bug before picgo v1.2.2
    const include: string | null = this.ctx.getConfig('picgo-plugin-pic-migrater.include') || null
    const exclude: string | null = this.ctx.getConfig('picgo-plugin-pic-migrater.exclude') || null
    const includesReg = new RegExp(include)
    const excludesReg = new RegExp(exclude)

    const result: IMigrateResult = {
      urls: [],
      success: 0,
      total: 0
    }

    if (!this.urlArray || this.urlArray.length === 0) {
      return result
    }

    const toUploadURLs = this.urlArray.filter(url => ((!include || includesReg.test(url)) && (!exclude || !excludesReg.test(url)))).map(async url => {
      return await new Promise<IImgInfo>(async (resolve, reject): Promise<void> => {
        result.total += 1

        try {
          let imgInfo: IImgInfo
          const picPath = this.getLocalPath(url)
          if (!picPath) {
            imgInfo = await this.handlePicFromURL(url)
          } else {
            imgInfo = await this.handlePicFromLocal(picPath, url)
          }
          resolve(imgInfo)
        } catch (err) {
          // dont reject
          resolve(undefined)
          this.ctx.log.error(err)
        }
      })
    })

    const toUploadImgs = await Promise.all(toUploadURLs).then(imgs => imgs.filter(img => img !== undefined))

    // upload
    let output = []
    if (toUploadImgs && toUploadImgs.length > 0) {
      if (this.guiApi) {
        output = await this.guiApi.upload(toUploadImgs)
      } else {
        try {
          const res = await this.ctx.upload(toUploadImgs)
          if (Array.isArray(res)) {
            output = res
          }
        } catch (e) {
          // fake output
          this.ctx.log.error(e)
          output = this.ctx.output
        }
      }
    }

    result.urls = output.filter(item => item.imgUrl && item.imgUrl !== item.origin).map(item => {
      return {
        original: item.origin,
        new: item.imgUrl
      }
    })
    result.success = result.urls.length

    this.ctx.setConfig({
      'picBed.transformer': originTransformer // for GUI reset config
    })

    return result
  }

  getLocalPath (imgPath: string): string | false {
    if (!path.isAbsolute(imgPath)) {
      imgPath = path.join(this.baseDir, imgPath)
    }
    if (fs.existsSync(imgPath)) {
      return imgPath
    } else {
      return false
    }
  }

  async getPicFromURL (url): Promise<Buffer> {
    const res = await this.ctx.request({
      url,
      encoding: null,
      responseType: "arraybuffer",
    })
    return Buffer.from(res, "utf-8")
  }

  async handlePicFromLocal (picPath: string, origin: string): Promise<IImgInfo | undefined> {
    if (fs.existsSync(picPath)) {
      const fileName = path.basename(picPath)
      const buffer = fs.readFileSync(picPath)
      const imgSize = getImageSize(buffer)
      return {
        buffer,
        fileName,
        width: imgSize.width,
        height: imgSize.height,
        extname: path.extname(picPath),
        origin
      }
    } else {
      return undefined
    }
  }

  async handlePicFromURL (url: string): Promise<IImgInfo | undefined> {
    try {
      const buffer = await this.getPicFromURL(url)
      const fileName = path.basename(url).split('?')[0].split('#')[0]
      const imgSize = getImageSize(buffer)
      console.log(imgSize)
      return {
        buffer,
        fileName,
        width: imgSize.width,
        height: imgSize.height,
        extname: `.${imgSize.type || 'png'}`,
        origin: url
      }
    } catch (e) {
      this.ctx.log.error(`handle pic from url ${url} fail: ${JSON.stringify(e)}`)
      return undefined
    }
  }
}

export default Migrater
