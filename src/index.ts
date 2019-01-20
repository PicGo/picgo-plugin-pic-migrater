import picgo from 'picgo'
import FileHandler from './lib/FileHandler'
import Migrater from './lib/Migrater'
import globby from 'globby'
import path from 'path'

const handleFiles = async (ctx: picgo, files: string[], fileHandler: FileHandler) => {
  for (let file of files) {
    // read File
    fileHandler.read(file)

    const migrater = new Migrater(ctx, file)
    migrater.init(fileHandler.getFileUrlList(file))

    // migrate pics
    const result = await migrater.migrate()
    let content = fileHandler.getFileContent(file)

    // replace content
    for (let originUrl in result.urlList) {
      content = content.replace(new RegExp(originUrl, 'g'), result.urlList[originUrl])
    }
    fileHandler.write(file, content)
  }
}

const guiMenu = (ctx: picgo) => {
  const fileHandler = new FileHandler(ctx)
  return [
    {
      label: '选择文件',
      async handle (ctx: picgo, guiApi: any) {
        try {
          const files = await guiApi.showFileExplorer({
            properties: ['openFile', 'multiSelections'],
            filters: [
              {
                name: 'Markdown Files',
                extensions: ['md']
              }
            ]
          })
          if (files) {
            handleFiles(ctx, files, fileHandler)
          } else {
            return false
          }
        } catch (e) {
          ctx.log.error(e)
        }
      }
    },
    {
      label: '选择文件夹',
      async handle (ctx: picgo, guiApi) {
        const result = await guiApi.showFileExplorer({
          properties: ['openDirectory']
        })
        if (result) {
          let sourceDir = result[0]
          let files = await globby(['**/*.md'], { cwd: sourceDir, dot: true })
          files = files.map(file => path.join(sourceDir, file))
          if (files.length > 0) {
            handleFiles(ctx, files, fileHandler)
          }
        } else {
          return false
        }
      }
    }
  ]
}

export = (ctx: picgo) => {
  const register = () => {
    return
  }
  return {
    register,
    guiMenu
  }
}
