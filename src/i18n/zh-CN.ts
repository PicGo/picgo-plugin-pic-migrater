/* eslint-disable no-template-curly-in-string */
export const zh = {
  PIC_MIGRATER_CHOOSE_FILE: '选择文件',
  PIC_MIGRATER_CHOOSE_FOLDER: '选择文件夹',
  PIC_MIGRATER_PROCESSING: '迁移进行中...',
  PIC_MIGRATER_BE_PATIENT: '请耐心等待',
  PIC_MIGRATER_SUCCESS: '迁移完成',
  PIC_MIGRATER_FAIL: '${file} 迁移失败',
  PIC_MIGRATER_FAIL_TIP: '无成功迁移的图片，请检查 URL 是否存在或者图床配置问题',
  PIC_MIGRATER_SUCCESS_TIP: '图片迁移成功：${success}张, 图片迁移失败：${fail}张',

  // config
  PIC_MIGRATER_CONFIG_TIP_TITLE: '请先进行配置',
  PIC_MIGRATER_CONFIG_TIP_BODY: '点击 配置plugin，配置插件之后方可使用',

  PIC_MIGRATER_CONFIG_NEW_FILE_SUFFIX: '新文件名后缀',
  PIC_MIGRATER_CONFIG_INCLUDE: '只包含',
  PIC_MIGRATER_CONFIG_EXCLUDE: '不包含',
  PIC_MIGRATER_CONFIG_OLD_CONTENT_WRITE_TO_NEW_FILE: '旧内容写入新文件',

  PIC_MIGRATER_CONFIG_TIPS: '请输入路径或者URL'
}

export type ILocales = typeof zh

export type ILocalesKey = keyof typeof zh
