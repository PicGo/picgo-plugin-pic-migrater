import fs from 'node:fs'
import globby from 'globby'
import path from 'node:path'
import type { IGuiMenuItem, PicGo, IPluginConfig } from 'picgo'
import FileHandler from './lib/FileHandler'
import Migrater from './lib/Migrater'
import { compare } from 'compare-versions'
import { initI18n, T } from './i18n'

const replaceAll = (content: string, originText: string, replaceText: string): string => {
  if (originText === replaceText) {
    return content
  }
  content = content.replace(new RegExp(originText, 'g'), replaceText)
  return content
}
const checkVersion = (ctx: PicGo, guiApi: any): void => {
  if (guiApi) {
    const picgoVersion = ctx.GUI_VERSION ?? '1.0.0'
    if (compare(picgoVersion, '2.3.0', '<')) {
      ctx.emit('notification', {
        title: 'PicGo version is lower than 2.3.0',
        body: 'please upgrade PicGo version'
      })
      throw Error('[pic-migrater] picgo version is lower than 2.3.0, some features will not work, please upgrade PicGo version')
    }
  } else {
    const picgoVersion = ctx.VERSION || '1.0.0'
    if (compare(picgoVersion, '1.5.0-alpha.1', '<')) {
      ctx.emit('notification', {
        title: 'PicGo-Core version is lower than 1.5.0-alpha.1',
        body: 'please upgrade PicGo-Core version or PicGo version'
      })
      throw Error('[pic-migrater] picgo-core version is lower than 1.5.0, some features will not work, please upgrade PicGo-Core version')
    }
  }
}

const migrateFiles = async (ctx: PicGo, files: string[], guiApi: any = undefined): Promise<{
  total: number
  success: number
}> => {
  checkVersion(ctx, guiApi)
  const $T = T(ctx)
  const newFileSuffix = ctx.getConfig<string>('picgo-plugin-pic-migrater.newFileSuffix')
  const oldContentWriteToNewFile = !!ctx.getConfig<boolean | undefined>('picgo-plugin-pic-migrater.oldContentWriteToNewFile')
  if (guiApi) {
    guiApi.showNotification({
      title: $T('PIC_MIGRATER_PROCESSING'),
      body: $T('PIC_MIGRATER_BE_PATIENT')
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
          title: $T('PIC_MIGRATER_FAIL', {
            file
          }),
          body: $T('PIC_MIGRATER_FAIL_TIP')
        })
      }
    } else {
      let content = fileHandler.getFileContent(file)
      // replace content
      result.urls.forEach((item) => {
        content = replaceAll(content, item.original, item.new)
      })
      fileHandler.write(file, content, newFileSuffix, oldContentWriteToNewFile)
    }
  }

  ctx.log.info(`Success: ${success} pics, Fail: ${total - success} pics`)
  if (guiApi) {
    guiApi.showNotification({
      title: $T('PIC_MIGRATER_SUCCESS'),
      body: $T('PIC_MIGRATER_SUCCESS_TIP', {
        success,
        fail: total - success
      })
    })
  }
  return {
    total,
    success
  }
}

const guiMenu = (ctx: PicGo): IGuiMenuItem[] => {
  const $T = T(ctx)
  const userConfig = ctx.getConfig<IMigraterConfig>('picgo-plugin-pic-migrater')
  return [
    {
      label: $T('PIC_MIGRATER_CHOOSE_FILE'),
      async handle (ctx: PicGo, guiApi: any) {
        if (!userConfig) {
          return guiApi.showNotification({
            title: $T('PIC_MIGRATER_CONFIG_TIP_TITLE'),
            body: $T('PIC_MIGRATER_CONFIG_TIP_BODY')
          })
        }
        try {
          let files: string[] = await guiApi.showFileExplorer({
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
            await migrateFiles(ctx, files, guiApi)
          } else {
            return false
          }
        } catch (e) {
          ctx.log.error(e)
        }
      }
    },
    {
      label: $T('PIC_MIGRATER_CHOOSE_FOLDER'),
      async handle (ctx: PicGo, guiApi: any) {
        if (!userConfig) {
          return guiApi.showNotification({
            title: $T('PIC_MIGRATER_CONFIG_TIP_TITLE'),
            body: $T('PIC_MIGRATER_CONFIG_TIP_BODY')
          })
        }
        const result = await guiApi.showFileExplorer({
          properties: ['openDirectory']
        })
        if (result) {
          const sourceDir = result[0] as string
          let files = await globby(['**/*.md'], { cwd: sourceDir, dot: true })
          files = files.map((file: string) => path.join(sourceDir, file))
          if (files.length > 0) {
            await migrateFiles(ctx, files, guiApi)
          }
        } else {
          return false
        }
      }
    }
  ]
}

const config = (ctx: PicGo): IPluginConfig[] => {
  const $T = T(ctx)
  let userConfig = ctx.getConfig<IMigraterConfig | undefined>('picgo-plugin-pic-migrater')
  userConfig ??= {};
  const config = [
    {
      name: 'newFileSuffix',
      get alias () {
        return $T('PIC_MIGRATER_CONFIG_NEW_FILE_SUFFIX')
      },
      type: 'input',
      message: '_new',
      default: userConfig.newFileSuffix,
      required: false
    },
    {
      name: 'include',
      get alias () {
        return $T('PIC_MIGRATER_CONFIG_INCLUDE')
      },
      get message () {
        return $T('PIC_MIGRATER_CONFIG_TIPS')
      },
      type: 'input',
      default: userConfig.include ?? '',
      required: false
    },
    {
      name: 'exclude',
      get alias () {
        return $T('PIC_MIGRATER_CONFIG_EXCLUDE')
      },
      get message () {
        return $T('PIC_MIGRATER_CONFIG_TIPS')
      },
      type: 'input',
      default: userConfig.exclude ?? '',
      required: false
    },
    {
      name: 'oldContentWriteToNewFile',
      get alias () {
        return $T('PIC_MIGRATER_CONFIG_OLD_CONTENT_WRITE_TO_NEW_FILE')
      },
      type: 'confirm',
      default: false,
      required: false
    }
  ]

  return config
}

export = (ctx: PicGo) => {
  initI18n(ctx)
  const register = (): void => {
    ctx.cmd.register('migrate', {
      handle (ctx: PicGo) {
        ctx.cmd.program
          .command('migrate <files...>')
          .description('migrating pictures url from markdown files')
          .action(async (files: string[]) => {
            const userConfig = ctx.getConfig<IMigraterConfig | undefined>('picgo-plugin-pic-migrater')
            if (!userConfig) {
              ctx.log.warn('You should configurate this plugin first!')
              ctx.log.info('picgo set plugin pic-migrater')
              return
            }
            files = files.map((item) => path.resolve(item))
            let inputFiles: string[] = []
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
              await migrateFiles(ctx, inputFiles)
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
    migrateFiles: migrateFiles.bind(null, ctx)
  }
}
