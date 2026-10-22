import type { IPicGo } from 'picgo'
import { zh } from './zh-CN'
import { en } from './en'
export const initI18n = (ctx: IPicGo): void => {
  // init i18n
  if (ctx?.i18n?.addLocale) {
    ctx.i18n.addLocale('zh-CN', zh)
    ctx.i18n.addLocale('en', en)
  }
}

export const T = (ctx: IPicGo) => (key: ILocalesKey, args: any = {}) => {
  if (ctx?.i18n?.translate) {
    return ctx.i18n.translate<ILocalesKey>(key, args) || zh[key]
  }
  return zh[key]
}
