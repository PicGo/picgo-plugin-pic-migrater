import fs from 'fs'
import path from 'path'
import picgo from 'picgo'

class FileHandler {
  ctx: picgo
  fileList: IFileList
  urlList: IURLList
  constructor (ctx: picgo) {
    this.ctx = ctx
    this.fileList = {}
    this.urlList = {}
  }

  read (file: string) {
    if (!fs.existsSync(file) && !(path.extname(file) === '.md')) {
      return
    }
    const content = fs.readFileSync(file, 'utf8')
    this.fileList[file] = content
    this.getFileUrlContent(file)
  }

  getFileUrlContent (file: string) {
    let urls = this.fileList[file].match(/\!\[.*\]\(.*\)/g)
    if (urls === null) {
      this.urlList[file] = {}
    } else {
      this.urlList[file] = {}
      for (let i of urls) {
        const url = i.match(/\!\[.*\]\((.*?)( ".*")?\)/)[1]
        this.urlList[file][url] = url
      }
    }
  }

  write (file: string, data: string, newSuffix = '_new') {
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

  getFileList () {
    return this.fileList
  }

  getUrlList () {
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
