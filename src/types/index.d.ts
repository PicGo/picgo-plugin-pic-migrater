interface IFileList {
  [key: string]: string
}

interface IURLList {
  [file: string]: {
    [url: string]: string
  }
}

interface IStringKeyMap {
  [key: string]: string | number
}

interface IMigraterConfig {
  newFileSuffix?: string
  include?: string
  exclude?: string
}
interface IMigrateResult {
  urls: Array<{
    original: string
    new: string
  }>
  success: number //  count of which was migrated
  total: number // total count of which should migrate
}

type ILocales = import('../i18n/zh-CN').ILocales
type ILocalesKey = import('../i18n/zh-CN').ILocalesKey
