/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable no-async-promise-executor */
import fs from 'node:fs'
import path from 'node:path'
import globby from 'globby'
import { IImgInfo, PicGo } from 'picgo'
import { getImageSize, isUrl, isUrlEncode, normalizePath, stripWikiLinkAlias } from '../utils'

const WIKI_LINK_REG = /^!\[\[(.*?)\]\]$/

/**
 * Returns the file target of an Obsidian embed, or undefined when the text is not one.
 */
const getWikiLinkTarget = (text: string): string | undefined => {
  const res = text.match(WIKI_LINK_REG)
  if (!res) {return undefined}
  return stripWikiLinkAlias(res[1])
}

/**
 * Obsidian resolves a short embed like `![[image.png]]` by searching the vault rather than by relative path,
 * so a plain join against the note's folder is not enough. Index basenames under the note's folder tree once
 * per folder and reuse it, since a migration usually walks many notes sharing the same root.
 */
const basenameIndexCache = new Map<string, Map<string, string>>()

const getBasenameIndex = (dir: string): Map<string, string> => {
  const cached = basenameIndexCache.get(dir)
  if (cached) {return cached}
  const index = new Map<string, string>()
  try {
    const files: string[] = globby.sync(['**/*'], { cwd: dir, dot: false, onlyFiles: true })
    for (const file of files) {
      const key = path.basename(file).toLowerCase()
      // First match wins, mirroring Obsidian's behaviour of resolving to a single file.
      if (!index.has(key)) {
        index.set(key, normalizePath(path.join(dir, file)))
      }
    }
  } catch (e) {
    // An unreadable folder just means no index; resolution falls back to the relative path.
  }
  basenameIndexCache.set(dir, index)
  return index
}

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
    const include: string | null = this.ctx.getConfig('picgo-plugin-pic-migrater.include') ?? 'null'
    const exclude: string | null = this.ctx.getConfig('picgo-plugin-pic-migrater.exclude') ?? 'null'
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
      return await new Promise<IImgInfo | undefined>(async (resolve, reject): Promise<void> => {
        result.total += 1

        try {
          let imgInfo: IImgInfo | undefined
          const wikiLinkTarget = getWikiLinkTarget(url)
          const target = wikiLinkTarget ?? url
          const isUrlPath = isUrl(target)
          if (isUrlPath) {
            imgInfo = await this.handlePicFromURL(target)
          } else {
            const picPath = wikiLinkTarget !== undefined
              ? this.getWikiLinkLocalPath(wikiLinkTarget)
              : this.getLocalPath(target)
            if (picPath) {
              imgInfo = await this.handlePicFromLocal(picPath, url)
            } else {
              imgInfo = undefined
            }
          }
          if (imgInfo) {
            // Keep `origin` as the original text so the replacement in index.ts swaps the whole
            // `![[...]]` embed, not just the path inside it.
            imgInfo.origin = url
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
    let output: IImgInfo[] = []
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

    result.urls = output.map((item, index) => {
      const original = toUploadImgs[index]?.origin ?? item.origin
      if (!item.imgUrl || !original || item.imgUrl === original) {
        return null
      }
      return {
        original,
        new: item.imgUrl
      }
    }).filter((item) => item !== null)

    result.success = result.urls.length

    this.ctx.setConfig({
      'picBed.transformer': originTransformer // for GUI reset config
    })

    return result
  }

  /**
   * Resolves an Obsidian embed target: try it as a path relative to the note first, then fall back to a
   * vault-style basename lookup under the note's folder.
   */
  getWikiLinkLocalPath (target: string): string | false {
    const relative = normalizePath(path.isAbsolute(target) ? target : path.join(this.baseDir, target))
    if (fs.existsSync(relative)) {
      return relative
    }
    const match = getBasenameIndex(this.baseDir).get(path.basename(target).toLowerCase())
    if (match && fs.existsSync(match)) {
      return match
    }
    this.ctx.log.warn(`wiki link target: ${target} not exist!`)
    return false
  }

  getLocalPath (imgPath: string): string | false {
    let localPath = path.isAbsolute(imgPath) ? imgPath : normalizePath(path.join(this.baseDir, imgPath))
    if (fs.existsSync(localPath)) {
      console.log('exist absolute local path', localPath)
      return localPath
    } else {
      // if path is url encode, try decode
      if (isUrlEncode(imgPath)) {
        localPath = normalizePath(decodeURI(imgPath))
        if (!path.isAbsolute(localPath)) {
          localPath = normalizePath(path.join(this.baseDir, localPath))
        }
        if (fs.existsSync(localPath)) {
          console.log('exist related local path', localPath)
          return localPath
        }
      }
      this.ctx.log.warn(`file path: ${imgPath} not exist!`)
      return false
    }
  }

  async getPicFromURL (url: string): Promise<Buffer> {
    const res = await this.ctx.request({
      url,
      encoding: null,
      responseType: 'arraybuffer'
    })
    return res
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
    const rawFileName = path.basename(url.split('?')[0].split('#')[0]) || 'image'
    try {
      const buffer = await this.getPicFromURL(url)
      const imgSize = getImageSize(buffer)
      const imgType = (imgSize.type ?? 'png').replace(/^\./, '')
      const extname = `.${imgType}`
      const fileName = path.extname(rawFileName) ? rawFileName : `${rawFileName}${extname}`
      return {
        buffer,
        fileName,
        width: imgSize.width,
        height: imgSize.height,
        extname,
        origin: url
      }
    } catch (e) {
      this.ctx.log.error(`handle pic from url ${url} fail: ${JSON.stringify(e)}`)
      return undefined
    }
  }
}

export default Migrater
