interface MigrateResult {
  urlList: {
    [picPath: string]: string
  }
  result: {
    success: number
    total: number
  }
}

export {
  MigrateResult
}
