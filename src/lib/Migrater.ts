import fs from 'node:fs'
import path from 'node:path'
import globby from 'globby'
import type { IImgInfo, IPicGo } from 'picgo'
import { isUrl, isUrlEncode, normalizePath, stripWikiLinkAlias } from '../utils'

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

interface IGuiUploader {
  upload: (inputs: string[]) => Promise<IImgInfo[]>
}

class Migrater {
  ctx: IPicGo
  guiApi: IGuiUploader | undefined
  urlArray: string[] = []
  baseDir: string
  constructor (ctx: IPicGo, guiApi: IGuiUploader | undefined, filePath: string) {
    this.guiApi = guiApi
    this.ctx = ctx
    this.baseDir = path.dirname(path.resolve(filePath))
  }

  init (urlList: IStringKeyMap): void {
    this.urlArray = Object.keys(urlList)
  }

  async migrate (): Promise<IMigrateResult> {
    const include: string = this.ctx.getConfig('picgo-plugin-pic-migrater.include') ?? ''
    const exclude: string = this.ctx.getConfig('picgo-plugin-pic-migrater.exclude') ?? ''
    const includesReg = new RegExp(include)
    const excludesReg = new RegExp(exclude)
    const urls = this.urlArray.filter(url => ((!include || includesReg.test(url)) && (!exclude || !excludesReg.test(url))))
    const result: IMigrateResult = { urls: [], success: 0, total: urls.length }

    const originalsByInput = this.getUploadInputs(urls)
    if (originalsByInput.size === 0) {return result}

    const originTransformer = this.ctx.getConfig<string | undefined>('picBed.transformer')
    this.ctx.setConfig({ 'picBed.transformer': 'path' })
    this.ctx.output = []
    try {
      const inputs = Array.from(originalsByInput.keys())
      let output: IImgInfo[] = []
      if (this.guiApi) {
        output = await this.guiApi.upload(inputs)
      } else {
        try {
          const uploaded = await this.ctx.upload(inputs)
          if (Array.isArray(uploaded)) {output = uploaded}
        } catch (e) {
          this.ctx.log.error(e as Error)
          output = this.ctx.output
        }
      }

      result.urls = this.getReplacements(output, originalsByInput)
      result.success = result.urls.length
      return result
    } finally {
      this.ctx.setConfig({ 'picBed.transformer': originTransformer })
    }
  }

  private getUploadInputs (urls: string[]): Map<string, string[]> {
    // Several Markdown spellings can resolve to one input. Core records that input
    // in origin; array positions are unreliable after failed uploads are filtered.
    const originalsByInput = new Map<string, string[]>()
    for (const original of urls) {
      try {
        const wikiTarget = getWikiLinkTarget(original)
        const target = wikiTarget ?? original
        const input = isUrl(target)
          ? target
          : wikiTarget !== undefined ? this.getWikiLinkLocalPath(target) : this.getLocalPath(target)
        if (!input) {continue}
        const originals = originalsByInput.get(input) ?? []
        originals.push(original)
        originalsByInput.set(input, originals)
      } catch (e) {
        this.ctx.log.error(e as Error)
      }
    }
    return originalsByInput
  }

  private getReplacements (output: IImgInfo[], originalsByInput: Map<string, string[]>): IMigrateResult['urls'] {
    const replacements: IMigrateResult['urls'] = []
    const replaced = new Set<string>()
    for (const item of output) {
      if (!item.imgUrl || !item.origin) {continue}
      const originals = originalsByInput.get(item.origin) ?? []
      for (const original of originals) {
        if (replaced.has(original) || item.imgUrl === original) {continue}
        replacements.push({ original, new: item.imgUrl })
        replaced.add(original)
      }
    }
    return replacements
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
      return localPath
    } else {
      // if path is url encode, try decode
      if (isUrlEncode(imgPath)) {
        localPath = normalizePath(decodeURI(imgPath))
        if (!path.isAbsolute(localPath)) {
          localPath = normalizePath(path.join(this.baseDir, localPath))
        }
        if (fs.existsSync(localPath)) {
          return localPath
        }
      }
      this.ctx.log.warn(`file path: ${imgPath} not exist!`)
      return false
    }
  }

}

export default Migrater
