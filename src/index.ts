import picgo from 'picgo'
import FileHandler from './lib/FileHandler'
import Migrater from './lib/Migrater'
import globby from 'globby'
import path from 'path'
import { PluginConfig } from 'picgo/dist/utils/interfaces'
import fs from 'fs'

const replaceAll = (content: string, originText: string, replaceText: string): string => {
  let index = content.indexOf(originText)
  while (index !== -1) {
    content = content.replace(originText, replaceText)
    index = content.indexOf(originText)
  }
  return content
}

const handleFiles = async (ctx: picgo, files: string[], guiApi: any = undefined) => {
  if (guiApi) {
    guiApi.showNotification({
      title: `迁移进行中...`,
      body: '请耐心等待'
    })
  }
  ctx.log.info('Migrating...')
  let total = 0
  let success = 0
  for (let file of files) {
    const fileHandler = new FileHandler(ctx)
    // read File
    fileHandler.read(file)

    const migrater = new Migrater(ctx, guiApi, file)
    migrater.init(fileHandler.getFileUrlList(file))

    // migrate pics
    const result = await migrater.migrate()
    total += result.result.total
    success += result.result.success
    if (result.result.success === 0 && (result.result.total !== 0)) {
      ctx.log.warn(`Please check your configuration, since no images migrated successfully in ${file}`)
      if (guiApi) {
        guiApi.showNotification({
          title: `${file}迁移失败！`,
          body: '迁移图片0成功，请检查是否是URL不存在或者图床配置问题'
        })
      }
      continue
    } else {
      let content = fileHandler.getFileContent(file)
      // replace content
      for (let originUrl in result.urlList) {
        content = replaceAll(content, originUrl, result.urlList[originUrl])
      }
      const newFileSuffix = ctx.getConfig('picgo-plugin-pic-migrater.newFileSuffix')
      fileHandler.write(file, content, newFileSuffix)
    }
  }
  ctx.log.info(`Success: ${success} pics, Fail: ${total - success} pics`)
  if (guiApi) {
    guiApi.showNotification({
      title: '迁移完成',
      body: `图片迁移成功：${success}张, 图片迁移失败：${total - success}张`
    })
  }
}

const guiMenu = (ctx: picgo) => {
  return [
    {
      label: '选择文件',
      async handle (ctx: picgo, guiApi: any) {
        let userConfig = ctx.getConfig('picgo-plugin-pic-migrater')
        if (!userConfig) {
          return guiApi.showNotification({
            title: '请先进行配置',
            body: '点击配置plugin，配置插件之后方可使用'
          })
        }
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
            await handleFiles(ctx, files, guiApi)
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
      async handle (ctx: picgo, guiApi: any) {
        let userConfig = ctx.getConfig('picgo-plugin-pic-migrater')
        if (!userConfig) {
          return guiApi.showNotification({
            title: '请先进行配置',
            body: '点击配置plugin，配置插件之后方可使用'
          })
        }
        const result = await guiApi.showFileExplorer({
          properties: ['openDirectory']
        })
        if (result) {
          let sourceDir = result[0]
          let files = await globby(['**/*.md'], { cwd: sourceDir, dot: true })
          files = files.map((file: string) => path.join(sourceDir, file))
          if (files.length > 0) {
            await handleFiles(ctx, files, guiApi)
          }
        } else {
          return false
        }
      }
    }
  ]
}

const config = (ctx: picgo): PluginConfig[] => {
  let userConfig = ctx.getConfig('picgo-plugin-pic-migrater')
  if (!userConfig) {
    userConfig = {}
  }
  const config = [
    {
      name: 'newFileSuffix',
      alias: '文件名后缀',
      type: 'input',
      message: '_new',
      default: userConfig.newFileSuffix,
      required: false
    },
    {
      name: 'include',
      alias: '只包含',
      type: 'input',
      default: userConfig.include || '',
      required: false
    },
    {
      name: 'exclude',
      alias: '不包含',
      type: 'input',
      default: userConfig.exclude || '',
      required: false
    }
  ]

  return config
}

export = (ctx: picgo) => {
  const register = () => {
    ctx.cmd.register('migrate', {
      handle (ctx: picgo) {
        ctx.cmd.program
          .command('migrate <files...>')
          .description('migrating pictures url from markdown files')
          .action(async (files: string[]) => {
            let userConfig = ctx.getConfig('picgo-plugin-pic-migrater')
            if (!userConfig) {
              ctx.log.warn('You should configurate this plugin first!')
              ctx.log.info('picgo set plugin pic-migrater')
              return
            }
            files = files.map(item => path.resolve(item))
            let inputFiles = []
            for (let filePath of files) {
              // make sure filePath exists
              if (fs.existsSync(filePath)) {
                let status = fs.statSync(filePath)
                if (status.isDirectory()) {
                  let mdFiles = await globby(['**/*.md'], { cwd: filePath, dot: true })
                  mdFiles = mdFiles.map((file: string) => path.resolve(filePath, file))
                  inputFiles = inputFiles.concat(mdFiles)
                } else if (status.isFile()) {
                  inputFiles.push(filePath)
                }
              }
            }
            if (inputFiles.length > 0) {
              await handleFiles(ctx, inputFiles)
            }
          })
          .on('--help', () => {
            console.log()
            console.log('Note:')
            console.log('You should configurate this plugin first!')
            console.log('picgo set plugin pic-migrater')
            console.log()
            console.log('Examples:')
            console.log()
            console.log('  # migrate file or files')
            console.log('  $ picgo migrate ./test.md ./test1.md')
            console.log()
            console.log('  # migrate markdown files in folder')
            console.log('  $ picgo migrate ./test/')
            console.log()
          })
      }
    })
  }
  return {
    register,
    config,
    guiMenu
  }
}
