#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')
const program = require('commander')
const webpack = require('webpack')
const {writeFile} = require('@s-ui/helpers/file')

const config = require('../webpack.config.prod.js')
const linkLoaderConfigBuilder = require('../loaders/linkLoaderConfigBuilder.js')
const log = require('../shared/log.js')
const {config: projectConfig} = require('../shared/index.js')

process.env.NODE_ENV = process.env.NODE_ENV || 'production'

program
  .option('-C, --clean', 'Remove public folder before create a new one')
  .option(
    '-l, --link-package [package]',
    'Replace each occurrence of this package with an absolute path to this folder',
    (v, m) => {
      m.push(v)
      return m
    },
    []
  )
  .option('-c, --context [folder]', 'Context folder (cwd by default)')
  .on('--help', () => {
    console.log('  Examples:')
    console.log('')
    console.log('    $ sui-bundler build -S')
    console.log('    $ sui-bundler build -SC')
    console.log('    $ sui-bundler dev --link-package /my/domain/folder')
    console.log('    $ sui-bundler build --help')
    console.log('')
  })
  .parse(process.argv)

const {
  clean = false,
  context,
  linkPackage: packagesToLink = []
} = program.opts()

config.context = context || config.context

const nextConfig = packagesToLink.length
  ? linkLoaderConfigBuilder({
      config,
      packagesToLink,
      linkAll: false
    })
  : config

if (clean) {
  log.processing('Removing previous build...')
  fs.rmSync(path.resolve(process.env.PWD, 'public'), {
    force: true,
    recursive: true
  })
}

log.processing('Generating minified bundle...')

webpack(nextConfig).run(async (error, stats) => {
  if (error) {
    log.error(error)
    return 1
  }

  if (stats.hasErrors()) {
    const jsonStats = stats.toJson('errors-only')
    return jsonStats.errors.map(({message}) => log.error(message))
  }

  if (stats.hasWarnings()) {
    const jsonStats = stats.toJson('errors-warnings')
    log.warn('Webpack generated the following warnings: ')
    jsonStats.warnings.map(({message}) => log.warn(message))
  }

  console.log(`Webpack stats: ${stats}`)

  const offlinePath = path.join(process.cwd(), 'src', 'offline.html')
  const offlinePageExists = fs.existsSync(offlinePath)
  const {offline: offlineConfig = {}} = projectConfig

  const staticsCacheOnly = offlineConfig.staticsCacheOnly || false

  const resolvePublicFile = file => path.resolve(process.cwd(), 'public', file)

  if (offlinePageExists) {
    fs.copyFileSync(
      path.resolve(offlinePath),
      resolvePublicFile('offline.html')
    )
  }

  if (offlinePageExists || staticsCacheOnly) {
    const manifest = require(resolvePublicFile('asset-manifest.json'))

    const rulesOfFilesToNotCache = [
      'runtime~', // webpack's runtime chunks are not meant to be cached
      'LICENSE.txt', // avoid LICENSE files
      '.map' // source maps
    ]
    const manifestStatics = Object.values(manifest).filter(
      url => !rulesOfFilesToNotCache.some(rule => url.includes(rule))
    )

    const importScripts = offlineConfig.importScripts || []

    const stringImportScripts = importScripts
      .map(url => `importScripts("${url}")`)
      .join('\n')

    Boolean(importScripts.length) &&
      console.log('\nExternal Scripts Added to the SW:\n', stringImportScripts)

    // read the service worker template
    const swTemplate = fs.readFileSync(
      path.resolve(__dirname, '..', 'service-worker.js'),
      'utf-8'
    )

    // replace all the variables from the template with the actual values
    const swCode = swTemplate
      .replace('// IMPORT_SCRIPTS_HERE', stringImportScripts)
      .replace("require('static-manifest')", JSON.stringify(manifestStatics))
      .replace(
        "require('static-cache-name')",
        JSON.stringify(Date.now().toString())
      )
      .replace(
        "require('static-statics-cache-only')",
        JSON.stringify(staticsCacheOnly)
      )

    const swFilePath = resolvePublicFile('service-worker.js')

    await writeFile(swFilePath, swCode)
    console.log('\nService worker generated succesfully!\n')
  }

  log.success(
    `Your app is compiled in ${process.env.NODE_ENV} mode in /public. It's ready to roll!`
  )

  return 0
})
