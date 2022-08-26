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
      this.ctx.log.warn(`${file} is not exists`)
      return
    }
    const content = fs.readFileSync(file, 'utf8')
    this.fileList[file] = content
    this.getUrlListFromFileContent(file)
  }

  getUrlListFromFileContent (file: string): void {
    const content = this.fileList[file] || ''
    const markdownURLList = (content.match(/\!\[.*\]\(.*\)/g) || []).map((item: string) => {
      const res = item.match(/\!\[.*\]\((.*?)( ".*")?\)/)
      if (res) {
        return res[1]
      }
      return null
    }).filter(item => item)
    const imageTagURLList = (content.match(/<img.*?(?:>|\/>)/gi) || []).map((item: string) => {
      const res = item.match(/src=[\'\"]?([^\'\"]*)[\'\"]?/i)
      if (res) {
        return res[1]
      }
      return null
    }).filter(item => item)
    const urls = markdownURLList.concat(imageTagURLList)
    this.urlList[file] = {}
    for (const url of urls) {
      this.urlList[file][url] = url
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
