/* eslint-disable no-useless-escape */
import fs from 'fs'
import path from 'path'
import { PicGo } from 'picgo'

class FileHandler {
  ctx: PicGo
  fileList: IFileList
  urlList: IURLList
  constructor (ctx: PicGo) {
    this.ctx = ctx
    this.fileList = {}
    this.urlList = {}
  }

  read (file: string): void {
    if (!fs.existsSync(file) && !(path.extname(file) === '.md')) {
      return
    }
    const content = fs.readFileSync(file, 'utf8')
    this.fileList[file] = content
    this.getFileUrlContent(file)
  }

  getFileUrlContent (file: string): void {
    const urls = this.fileList[file].match(/\!\[.*\]\(.*\)/g)
    if (urls === null) {
      this.urlList[file] = {}
    } else {
      this.urlList[file] = {}
      for (const i of urls) {
        const url = i.match(/\!\[.*\]\((.*?)( ".*")?\)/)[1]
        this.urlList[file][url] = url
      }
    }
  }

  write (file: string, data: string, newSuffix = '_new'): void {
    const baseName = path.basename(file, '.md')
    const dirName = path.dirname(file)
    const resultFileName = path.join(dirName, baseName + newSuffix + '.md')
    try {
      fs.writeFileSync(resultFileName, data, 'utf8')
      this.ctx.log.success(`Write ${resultFileName} successfully`)
    } catch (e) {
      this.ctx.log.error(e)
    }
  }

  getFileList (): IFileList {
    return this.fileList
  }

  getUrlList (): IURLList {
    return this.urlList
  }

  getFileUrlList (file: string): IStringKeyMap {
    return this.urlList[file]
  }

  getFileContent (file: string): string {
    return this.fileList[file]
  }
}

export default FileHandler
