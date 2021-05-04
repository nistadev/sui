#!/usr/bin/env node

const {execSync} = require('child_process')
const path = require('path')
const {writeFileSync} = require('fs')
const {rm} = require('fs/promises')

/** In order to ensure this could work on postinstall script and also manually
 * we neet to check if INIT_CWD is available and use it instead cwd
 * as on postinstall the cwd will change
 */
const {CI = false, INIT_CWD} = process.env
const cwd = INIT_CWD || process.cwd()
const pkgPath = path.join(cwd, 'package.json')

const HUSKY_VERSION = '6.0.0'

const packageJson = require(pkgPath)
const {name} = packageJson

const PRE_COMMIT_SCRIPT = 'npm run lint --if-present'
const PRE_PUSH_SCRIPT = 'npm run test --if-present'

function log(...args) {
  /* eslint-disable no-console */
  args[0] = '[sui-precommit] ' + args[0]
  console.log(...args)
}

/**
 * Write package.json file where command was executed
 * @param {object} pkg New package content to be write on the file
 */
function writePackageJson(pkg) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), {encoding: 'utf8'})
}

/**
 * Install husky on project
 * @return {Promise<number>}
 */
function installHuskyIfNotInstalled() {
  if (!isHuskyInstalled()) {
    log('husky will be installed to allow git hook integration with node')
    console.log(cwd)
    execSync(`npm install husky@${HUSKY_VERSION} --save-dev --save-exact`, {cwd})
  }
  return Promise.resolve()
}

/**
 * Get if husky is already installed with the expected version
 * @return {Boolean}
 */
function isHuskyInstalled() {
  const pkg = require(pkgPath)
  const huskyDependencyVersion = pkg.devDependencies && pkg.devDependencies.husky
  return huskyDependencyVersion === HUSKY_VERSION
}

/** We avoid performing the precommit install:
 **  - for CI and the same precommit package
 **  - for the `@s-ui/precommit` pkg itself */
 if (CI === false && name !== '@s-ui/precommit') {
  installHuskyIfNotInstalled()
    .then(async () => {
      // extract previous husky config
      const {husky, ...restOfPackageJson} = packageJson
      // add husky or replace husky version
      restOfPackageJson.devDependencies ||= {}
      restOfPackageJson.devDependencies.husky = HUSKY_VERSION
      // update package json content
      writePackageJson(restOfPackageJson)
      // remove .husky folder with previous
      await rm(`${INIT_CWD}/.husky`, { recursive: true })
      execSync('npx husky install', {cwd})
      execSync(`npx husky add .husky/pre-commit "${PRE_COMMIT_SCRIPT}"`, {cwd})
      execSync(`npx husky add .husky/pre-push "${PRE_PUSH_SCRIPT}"`, {cwd})
    })
    .catch(err => {
      log(err.message)
      log('Installation has FAILED.')
      process.exit(1)
    })
}