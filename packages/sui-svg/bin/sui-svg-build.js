#!/usr/bin/env node
/* eslint no-console:0 */
const fg = require('fast-glob')
const svgr = require('@svgr/core').default
const fs = require('fs-extra')
const program = require('commander')
const {join} = require('path')
const toCamelCase = require('lodash.camelcase')
const babel = require('@babel/core')
const {getSpawnPromise} = require('@s-ui/helpers/cli')

const template = require('../templates/icon-component')
const BASE_DIR = process.cwd()
const ATOM_ICON_VERSION = 1
const LIB_FOLDER = join(BASE_DIR, '.', 'lib')
const SVG_FOLDER = join(BASE_DIR, '.', 'src')

program
  .on('--help', () => {
    console.log('  Description:')
    console.log('')
    console.log('    Builds React lib based on svg files')
    console.log('')
    console.log('    Setup your repo with a svg folder')
    console.log('    Every svg file inside this folder will be converted into')
    console.log('    a React component')
    console.log('')
  })
  .parse(process.argv)

const camelCase = fileName => {
  const camelFile = toCamelCase(fileName)
  return `${camelFile[0].toUpperCase()}${camelFile.slice(1)}`
}

const getLibFile = file => {
  const [, rawPath, rawfileName] = file.match('^.*/src/(.+/)*(.*).svg$')
  const fileName = camelCase(rawfileName)
  const path = rawPath || ''
  return `${LIB_FOLDER}/${path}${fileName}.js`
}

const getAllSrcSvgFiles = () => fg([`${SVG_FOLDER}/**/*.svg`])

const transfomrSvgToReact = svg =>
  svgr(svg, {
    template,
    expandProps: false,
    removeTitle: true
  })

const transformCodeWithBabel = jsCode =>
  babel.transformAsync(jsCode, {
    presets: [require.resolve('babel-preset-sui')]
  })

const installNeededDependencies = () =>
  getSpawnPromise('npm', [
    'install',
    `@s-ui/react-atom-icon@${ATOM_ICON_VERSION}`,
    '--save-exact'
  ])

const copyStylesFile = () => {
  fs.copy(
    require.resolve('../templates/icon-styles.scss'),
    `${LIB_FOLDER}/index.scss`
  )
}

fs.emptyDir(LIB_FOLDER)
  .then(installNeededDependencies)
  .then(getAllSrcSvgFiles)
  .then(entries =>
    entries.forEach(file => {
      fs.readFile(file, 'utf8')
        .then(transfomrSvgToReact)
        .then(transformCodeWithBabel)
        .then(result => fs.outputFile(getLibFile(file), result.code))
        .catch(error => {
          console.error(error)
        })
    })
  )
  .then(copyStylesFile)
