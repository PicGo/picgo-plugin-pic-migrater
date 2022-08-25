interface IFileList {
  [key: string]: string
}

interface IURLList {
  [file: string]: {
    [url: string]: string
  }
}

interface IStringKeyMap {
  [key: string]: string
}

interface IMigraterConfig {
  newFileSuffix?: string
  include?: string
  exclude?: string
}
