const { PicGo } = require('picgo')
const PluginMigrater = require('./dist/index')

const picgo = new PicGo()

picgo.setConfig({
  'picgo-plugin-pic-migrater': {
    newFileSuffix: '_new',
    include: '',
    exclude: ''
  }
})

const plugin = PluginMigrater(picgo);

(async () => {
  const res = await plugin.migrateFiles(['./test/test.md']) // { total: number, success: number }
  console.log(res)
})();
