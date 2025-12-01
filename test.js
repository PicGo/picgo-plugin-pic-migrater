const { PicGo } = require('picgo')
const PluginMigrater = require('./dist/index')
const assert = require('assert')

const picgo = new PicGo()

picgo.setConfig({
  'picgo-plugin-pic-migrater': {
    newFileSuffix: '_new',
    include: '',
    exclude: ''
  }
})

const plugin = picgo.use(PluginMigrater);

(async () => {
  const res = await plugin.migrateFiles(['./test/test.md']) // { total: number, success: number }
  console.log(res)
  assert.strictEqual(res.success, 6)
  assert.strictEqual(res.total, 7)
})();
