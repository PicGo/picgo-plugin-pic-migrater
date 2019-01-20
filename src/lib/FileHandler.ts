import picgo from 'picgo'
import fs from 'fs'
import path from 'path'

class FileHandler {
  ctx: picgo
  fileList: {
    [propName: string]: string
  }
  urlList: any
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
        const url = i.match(/\!\[.*\]\((.*)\)/)[1]
        this.urlList[file][url] = url
      }
    }
  }

  write (file: string, data: string, newName = '_new') {
    const baseName = path.basename(file, '.md')
    const dirName = path.dirname(file)
    const resultFileName = path.join(dirName, baseName + newName + '.md')
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

  getFileUrlList (file) {
    return this.urlList[file]
  }

  getFileContent (file: string) {
    return this.fileList[file]
  }

  clean () {
    this.fileList = {}
    this.urlList = {}
  }
}

export default FileHandler
