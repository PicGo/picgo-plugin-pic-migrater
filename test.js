const { PicGo } = require('picgo')
const PluginMigrater = require('./dist/index')
const assert = require('node:assert')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const FIXTURE = './test/test.md'
const SUFFIX = '_new'
const OUTPUT = './test/test' + SUFFIX + '.md'

// Serve the remote-image cases locally so the suite needs no network and no configured picBed.
// `/error` answers 400 to keep the "image that cannot be fetched" case.
const startServer = async () => {
  const logo = fs.readFileSync(path.join(__dirname, 'test', 'picgo-logo.png'))
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/error')) {
      res.writeHead(400).end()
      return
    }
    res.writeHead(200, { 'Content-Type': 'image/png' }).end(logo)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { server, port: server.address().port }
}

const run = async () => {
  const { server, port } = await startServer()
  const origin = `http://127.0.0.1:${port}`

  const source = fs.readFileSync(FIXTURE, 'utf8')
  // Point the fixture's remote URLs at the local server for the duration of the run.
  // Each URL must stay distinct: the migrater de-duplicates targets per file.
  let remote = 0
  const patched = source
    .replace(/https:\/\/mmbiz\.qpic\.cn\/mmbiz_png\/error_image/g, `${origin}/error.png`)
    .replace(/https:\/\/(raw\.githubusercontent\.com|mmbiz\.qpic\.cn)\/[^\s")]+/g, () => `${origin}/remote${++remote}.png`)
  fs.writeFileSync(FIXTURE, patched)

  let uploaded = 0
  const picgo = new PicGo()
  picgo.setConfig({
    'picgo-plugin-pic-migrater': {
      newFileSuffix: SUFFIX,
      include: '',
      exclude: ''
    }
  })
  // A stub uploader keeps the suite offline and its output deterministic.
  picgo.helper.uploader.register('test-uploader', {
    handle: async (ctx) => {
      ctx.output.forEach((img) => {
        img.imgUrl = `${origin}/uploaded/${++uploaded}.png`
      })
      return ctx
    }
  })
  picgo.setConfig({ 'picBed.current': 'test-uploader', 'picBed.uploader': 'test-uploader' })

  const plugin = picgo.use(PluginMigrater)

  try {
    const res = await plugin.migrateFiles([FIXTURE])
    console.log(res)
    assert.strictEqual(res.total, 9)
    assert.strictEqual(res.success, 8)

    const output = fs.readFileSync(OUTPUT, 'utf8')
    // Obsidian embeds become standard markdown, since an embed cannot carry a remote URL.
    assert.ok(!output.includes('![[picgo-logo.png]]'), 'wiki link embed should be migrated')
    assert.ok(!output.includes('![[Pasted image 20240101.png|300]]'), 'wiki link with display options should be migrated')
    // Note embeds and plain links are not images and must survive untouched.
    assert.ok(output.includes('![[Some note#heading]]'), 'note embed should be untouched')
    assert.ok(output.includes('[[Some note]]'), 'plain wiki link should be untouched')
    // The one image the server refuses keeps its original URL.
    assert.ok(output.includes(`${origin}/error.png`), 'failed image should keep its original url')
    console.log('All assertions passed')
  } finally {
    fs.writeFileSync(FIXTURE, source)
    if (fs.existsSync(OUTPUT)) fs.unlinkSync(OUTPUT)
    server.close()
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
