import fs from 'fs'
import path from 'path'
import picgo from 'picgo'
import { ImgInfo } from 'picgo/dist/utils/interfaces'
import probe from 'probe-image-size'
import { IMigrateResult } from './interface'

class Migrater {
  ctx: picgo
  guiApi: any
  urlArray: any[]
  baseDir: string
  constructor (ctx: picgo, guiApi: any, filePath: string) {
    this.guiApi = guiApi
    this.ctx = ctx
    this.baseDir = path.dirname(filePath)
  }

  init (urlList: any) {
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

    const toUploadURLs = this.urlArray.filter(url => ((!include || includesReg.test(url)) && (!exclude || !excludesReg.test(url)))).map(url => {
      return new Promise<ImgInfo>(async (resolve, reject) => {
        result.total += 1

        try {
          let imgInfo: ImgInfo
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
        await this.ctx.upload(toUploadImgs)
        output = this.ctx.output
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

  getLocalPath (imgPath: string) {
    if (!path.isAbsolute(imgPath)) {
      imgPath = path.join(this.baseDir, imgPath)
    }
    if (fs.existsSync(imgPath)) {
      return imgPath
    } else {
      return false
    }
  }

  getPicFromURL (url) {
    return this.ctx.Request.request({
      url,
      encoding: null
    })
  }

  async handlePicFromLocal (picPath: string, origin: string): Promise<ImgInfo | undefined> {
    if (fs.existsSync(picPath)) {
      let fileName = path.basename(picPath)
      let buffer = fs.readFileSync(picPath)
      let imgSize = probe.sync(buffer)
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

  async handlePicFromURL (url: string): Promise<ImgInfo | undefined> {
    try {
      let buffer = await this.getPicFromURL(url)
      let fileName = path.basename(url).split('?')[0].split('#')[0]
      let imgSize = probe.sync(buffer)
      return {
        buffer,
        fileName,
        width: imgSize.width,
        height: imgSize.height,
        extname: `.${imgSize.type}`,
        origin: url
      }
    } catch (e) {
      return undefined
    }
  }
}

export default Migrater
