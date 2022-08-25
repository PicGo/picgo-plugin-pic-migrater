import fs from 'fs'
import globby from 'globby'
import path from 'path'
import { IGuiMenuItem, PicGo, IPluginConfig } from 'picgo'
import FileHandler from './lib/FileHandler'
import Migrater from './lib/Migrater'

const replaceAll = (content: string, originText: string, replaceText: string): string => {
  if (originText === replaceText) {
    return content
  }
  content = content.replace(new RegExp(originText, 'g'), replaceText)
  return content
}

const handleFiles = async (ctx: PicGo, files: string[], guiApi: any = undefined): Promise<{
  total: number
  success: number
}> => {
  const newFileSuffix = ctx.getConfig<string>('picgo-plugin-pic-migrater.newFileSuffix')
  if (guiApi) {
    guiApi.showNotification({
      title: '迁移进行中...',
      body: '请耐心等待'
    })
  }
  ctx.log.info('Migrating...')

  let total = 0
  let success = 0

  for (const file of files) {
    const fileHandler = new FileHandler(ctx)
    // read File
    fileHandler.read(file)
    const migrater = new Migrater(ctx, guiApi, file)
    migrater.init(fileHandler.getFileUrlList(file))

    // migrate pics
    const result = await migrater.migrate()

    if (result.total === 0) {
      // early next
      continue
    }

    total += result.total
    success += result.success
    if (result.success === 0 && result.total !== 0) {
      ctx.log.warn(
        `Please check your configuration, since no images migrated successfully in ${file}`
      )
      if (guiApi) {
        guiApi.showNotification({
          title: `${file} 迁移失败！`,
          body: '无成功迁移的图片，请检查 URL 是否存在或者图床配置问题'
        })
      }
    } else {
      let content = fileHandler.getFileContent(file)
      // replace content
      result.urls.forEach((item) => {
        content = replaceAll(content, item.original, item.new)
      })
      fileHandler.write(file, content, newFileSuffix)
    }
    return {
      total,
      success
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

const guiMenu = (ctx: PicGo): IGuiMenuItem[] => {
  const userConfig = ctx.getConfig<IMigraterConfig>('picgo-plugin-pic-migrater')
  return [
    {
      label: '选择文件',
      async handle (ctx: PicGo, guiApi: any) {
        if (!userConfig) {
          return guiApi.showNotification({
            title: '请先进行配置',
            body: '点击配置plugin，配置插件之后方可使用'
          })
        }
        try {
          let files = await guiApi.showFileExplorer({
            properties: ['openFile', 'multiSelections'],
            filters: [
              {
                name: 'Markdown Files',
                extensions: ['md']
              }
            ]
          })
          if (files) {
            if (typeof files === 'string') {
              files = [files]
            }
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
      async handle (ctx: PicGo, guiApi: any) {
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
          const sourceDir = result[0]
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

const config = (ctx: PicGo): IPluginConfig[] => {
  let userConfig = ctx.getConfig<IMigraterConfig>('picgo-plugin-pic-migrater')
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

export = (ctx: PicGo) => {
  const register = (): void => {
    ctx.cmd.register('migrate', {
      handle (ctx: PicGo) {
        ctx.cmd.program
          .command('migrate <files...>')
          .description('migrating pictures url from markdown files')
          .action(async (files: string[]) => {
            const userConfig = ctx.getConfig<IMigraterConfig>('picgo-plugin-pic-migrater')
            if (!userConfig) {
              ctx.log.warn('You should configurate this plugin first!')
              ctx.log.info('picgo set plugin pic-migrater')
              return
            }
            files = files.map((item) => path.resolve(item))
            let inputFiles = []
            for (const filePath of files) {
              // make sure filePath exists
              if (fs.existsSync(filePath)) {
                const status = fs.statSync(filePath)
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
            console.log(`
              Note:
              You should configurate this plugin first!
              picgo set plugin pic-migrater

              Examples:
                # migrate file or files
                $ picgo migrate ./test.md ./test1.md

                # migrate markdown files in folder
                $ picgo migrate ./test/
                `.replace(/  +/g, '')
            )
          })
      }
    })
  }
  return {
    register,
    config,
    guiMenu,
    migrateFiles: handleFiles.bind(null, ctx)
  }
}
