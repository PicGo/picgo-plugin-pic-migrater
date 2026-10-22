const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { PicGo } = require('picgo')
const PluginMigrater = require('./dist/index')
const Migrater = require('./dist/lib/Migrater').default

const FIXTURE_DIR = path.join(__dirname, 'test')
const SUFFIX = '_new'

const createTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'picgo-plugin-pic-migrater-'))
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const createPicGo = (dir, migraterConfig = {}) => {
  const picgo = new PicGo(path.join(dir, 'picgo-config.json'))
  for (const method of ['debug', 'info', 'warn', 'error', 'success']) {
    picgo.log[method] = () => {}
  }
  picgo.log.createLogger = () => picgo.log
  picgo.setConfig({
    'picgo-plugin-pic-migrater': {
      newFileSuffix: SUFFIX,
      ...migraterConfig
    }
  })
  return picgo
}

const copyFixture = (dir, name, targetName = name) => {
  const target = path.join(dir, targetName)
  fs.copyFileSync(path.join(FIXTURE_DIR, name), target)
  return target
}

const closeServer = async (server) => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

// Serve the remote-image cases locally so the suite needs no network and no configured picBed.
// `/error` answers 400 to keep the "image that cannot be fetched" case.
const startServer = async () => {
  const logo = fs.readFileSync(path.join(FIXTURE_DIR, 'picgo-logo.png'))
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

const testFixtureMigration = async () => {
  const dir = createTempDir()
  const { server, port } = await startServer()
  const origin = `http://127.0.0.1:${port}`

  try {
    copyFixture(dir, 'picgo-logo.png')
    copyFixture(dir, 'picgo logo.png')
    copyFixture(dir, 'Pasted image 20240101.png')

    const source = fs.readFileSync(path.join(FIXTURE_DIR, 'test.md'), 'utf8')
    let remote = 0
    const markdown = source
      .replace(/https:\/\/mmbiz\.qpic\.cn\/mmbiz_png\/error_image/g, `${origin}/error.png`)
      .replace(/https:\/\/(raw\.githubusercontent\.com|mmbiz\.qpic\.cn)\/[^\s")]+/g, () => `${origin}/remote${++remote}.png`)
    const fixture = path.join(dir, 'test.md')
    fs.writeFileSync(fixture, markdown)

    let uploaded = 0
    const uploadInputs = []
    const picgo = createPicGo(dir)
    picgo.setConfig({ 'picBed.transformer': 'base64' })
    picgo.helper.uploader.register('test-uploader', {
      handle: async (ctx) => {
        uploadInputs.push(...ctx.input)
        assert.ok(ctx.input.every(input => typeof input === 'string'), 'PicGo Core should receive only string inputs')
        assert.strictEqual(ctx.getConfig('picBed.transformer'), 'path')
        ctx.output.forEach((img) => {
          img.imgUrl = `${origin}/uploaded/${++uploaded}.png`
        })
        return ctx
      }
    })
    picgo.setConfig({ 'picBed.current': 'test-uploader', 'picBed.uploader': 'test-uploader' })

    const plugin = picgo.use(PluginMigrater)
    const result = await plugin.migrateFiles([fixture])

    assert.deepStrictEqual(result, { total: 9, success: 8 })
    assert.ok(uploadInputs.length > 0)
    assert.strictEqual(picgo.getConfig('picBed.transformer'), 'base64', 'transformer should be restored after success')

    const output = fs.readFileSync(path.join(dir, `test${SUFFIX}.md`), 'utf8')
    assert.ok(!output.includes('![[picgo-logo.png]]'), 'wiki link embed should be migrated')
    assert.ok(!output.includes('![[Pasted image 20240101.png|300]]'), 'wiki link with display options should be migrated')
    const wikiSection = output.split('### obsidian wiki link')[1]
    const migratedWikiEmbeds = wikiSection.match(new RegExp(`^!\\[\\]\\(${escapeRegExp(origin)}\/uploaded\/\\d+\\.png\\)$`, 'gm')) ?? []
    assert.strictEqual(migratedWikiEmbeds.length, 2, 'wiki embeds should become complete markdown images')
    assert.ok(output.includes('![[Some note#heading]]'), 'note embed should be untouched')
    assert.ok(output.includes('[[Some note]]'), 'plain wiki link should be untouched')
    assert.ok(output.includes(`${origin}/error.png`), 'failed image should keep its original url')
  } finally {
    await closeServer(server)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const testMinimumPicGoVersion = async () => {
  const dir = createTempDir()

  try {
    const picgo = createPicGo(dir)
    const plugin = picgo.use(PluginMigrater)
    const originalCoreVersion = picgo.VERSION
    const originalGuiVersion = picgo.GUI_VERSION
    const guiApi = { showNotification: () => {} }

    try {
      picgo.VERSION = '2.3.0'
      await assert.rejects(plugin.migrateFiles([]), /PicGo-Core version is lower than 3\.0\.0/)
      picgo.VERSION = '3.0.0'
      assert.deepStrictEqual(await plugin.migrateFiles([]), { total: 0, success: 0 })

      picgo.GUI_VERSION = '2.3.0'
      await assert.rejects(plugin.migrateFiles([], guiApi), /PicGo version is lower than 3\.0\.0/)
      picgo.GUI_VERSION = '3.0.0'
      assert.deepStrictEqual(await plugin.migrateFiles([], guiApi), { total: 0, success: 0 })
    } finally {
      picgo.VERSION = originalCoreVersion
      picgo.GUI_VERSION = originalGuiVersion
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const testCoreOriginMappingAndFilters = async () => {
  const dir = createTempDir()
  const { server, port } = await startServer()
  const failedUrl = `http://127.0.0.1:${port}/error.png`

  try {
    const image = copyFixture(dir, 'picgo-logo.png', 'shared image.png')
    const picgo = createPicGo(dir)
    picgo.setConfig({ 'picBed.transformer': 'base64' })

    let uploaded = 0
    picgo.helper.uploader.register('mapping-uploader', {
      handle: async (ctx) => {
        assert.ok(ctx.input.every(input => typeof input === 'string'), 'PicGo Core should receive paths instead of image objects')
        assert.strictEqual(ctx.getConfig('picBed.transformer'), 'path')
        ctx.output.forEach((item) => {
          assert.strictEqual(item.origin, image)
          item.imgUrl = `https://example.test/core-${++uploaded}.png`
        })
        return ctx
      }
    })
    picgo.setConfig({ 'picBed.current': 'mapping-uploader', 'picBed.uploader': 'mapping-uploader' })

    const migrater = new Migrater(picgo, undefined, path.join(dir, 'note.md'))
    migrater.init({
      [failedUrl]: failedUrl,
      './missing.png': './missing.png',
      './shared image.png': './shared image.png',
      'shared%20image.png': 'shared%20image.png',
      '![[shared image.png]]': '![[shared image.png]]'
    })
    const result = await migrater.migrate()

    assert.strictEqual(result.total, 5)
    assert.strictEqual(result.success, 3)
    assert.deepStrictEqual(result.urls.map(item => item.original), [
      './shared image.png',
      'shared%20image.png',
      '![[shared image.png]]'
    ])
    assert.strictEqual(picgo.getConfig('picBed.transformer'), 'base64')

    picgo.setConfig({
      'picgo-plugin-pic-migrater': {
        newFileSuffix: SUFFIX,
        include: 'shared',
        exclude: '%20'
      }
    })
    const filteredMigrater = new Migrater(picgo, undefined, path.join(dir, 'note.md'))
    filteredMigrater.init({
      [failedUrl]: failedUrl,
      './missing.png': './missing.png',
      './shared image.png': './shared image.png',
      'shared%20image.png': 'shared%20image.png',
      '![[shared image.png]]': '![[shared image.png]]'
    })
    const filteredResult = await filteredMigrater.migrate()

    assert.strictEqual(filteredResult.total, 2, 'include and exclude should filter before migration')
    assert.strictEqual(filteredResult.success, 2)
    assert.deepStrictEqual(filteredResult.urls.map(item => item.original), [
      './shared image.png',
      '![[shared image.png]]'
    ])
    assert.strictEqual(picgo.getConfig('picBed.transformer'), 'base64')
  } finally {
    await closeServer(server)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const testCoreErrorUsesPartialOutput = async () => {
  const dir = createTempDir()

  try {
    copyFixture(dir, 'picgo-logo.png', 'first.png')
    const second = copyFixture(dir, 'picgo-logo.png', 'second.png')
    const picgo = createPicGo(dir)
    picgo.setConfig({ 'picBed.transformer': 'custom' })

    const loggedErrors = []
    picgo.log.error = (error) => loggedErrors.push(error)
    picgo.upload = async (inputs) => {
      assert.ok(inputs.every(input => typeof input === 'string'))
      assert.strictEqual(picgo.getConfig('picBed.transformer'), 'path')
      picgo.output = [{ origin: second, imgUrl: 'https://example.test/partial.png' }]
      throw new Error('core upload failed after a partial success')
    }

    const migrater = new Migrater(picgo, undefined, path.join(dir, 'note.md'))
    migrater.init({
      './first.png': './first.png',
      './second.png': './second.png'
    })
    const result = await migrater.migrate()

    assert.deepStrictEqual(result.urls, [{
      original: './second.png',
      new: 'https://example.test/partial.png'
    }])
    assert.strictEqual(result.total, 2)
    assert.strictEqual(result.success, 1)
    assert.strictEqual(loggedErrors.length, 1, 'Core upload errors should be logged')
    assert.strictEqual(picgo.getConfig('picBed.transformer'), 'custom', 'transformer should be restored after a Core error')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const testGuiOriginMapping = async () => {
  const dir = createTempDir()

  try {
    const first = copyFixture(dir, 'picgo-logo.png', 'first.png')
    const second = copyFixture(dir, 'picgo-logo.png', 'second.png')
    const picgo = createPicGo(dir)
    picgo.setConfig({ 'picBed.transformer': 'custom' })

    const guiApi = {
      upload: async (inputs) => {
        assert.ok(inputs.every(input => typeof input === 'string'), 'GUI upload should receive only string inputs')
        return [
          { origin: second, imgUrl: 'https://example.test/gui-second.png' },
          { origin: first, imgUrl: 'https://example.test/gui-first.png' }
        ]
      }
    }
    const migrater = new Migrater(picgo, guiApi, path.join(dir, 'note.md'))
    migrater.init({
      './missing.png': './missing.png',
      './first.png': './first.png',
      './second.png': './second.png'
    })
    const result = await migrater.migrate()

    assert.strictEqual(result.total, 3)
    assert.strictEqual(result.success, 2)
    assert.deepStrictEqual(result.urls, [
      { original: './second.png', new: 'https://example.test/gui-second.png' },
      { original: './first.png', new: 'https://example.test/gui-first.png' }
    ])
    assert.strictEqual(picgo.getConfig('picBed.transformer'), 'custom')

    const noOriginMigrater = new Migrater(picgo, {
      upload: async () => [{ imgUrl: 'https://example.test/no-origin.png' }]
    }, path.join(dir, 'note.md'))
    noOriginMigrater.init({ './first.png': './first.png' })
    const noOriginResult = await noOriginMigrater.migrate()

    assert.strictEqual(noOriginResult.success, 0, 'output without origin must not fall back to its array position')
    assert.deepStrictEqual(noOriginResult.urls, [])
    assert.strictEqual(picgo.getConfig('picBed.transformer'), 'custom')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const testGuiErrorRestoresTransformer = async () => {
  const dir = createTempDir()

  try {
    copyFixture(dir, 'picgo-logo.png', 'image.png')
    const picgo = createPicGo(dir)
    picgo.setConfig({ 'picBed.transformer': 'custom' })
    const expected = new Error('GUI upload failed')
    const migrater = new Migrater(picgo, {
      upload: async () => { throw expected }
    }, path.join(dir, 'note.md'))
    migrater.init({ './image.png': './image.png' })

    await assert.rejects(migrater.migrate(), error => error === expected)
    assert.strictEqual(picgo.getConfig('picBed.transformer'), 'custom', 'transformer should be restored after a GUI error')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const run = async () => {
  await testMinimumPicGoVersion()
  await testFixtureMigration()
  await testCoreOriginMappingAndFilters()
  await testCoreErrorUsesPartialOutput()
  await testGuiOriginMapping()
  await testGuiErrorRestoresTransformer()
  console.log('All assertions passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
