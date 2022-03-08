/* eslint no-console:0 */
import {promisify} from 'node:util'
import {exec as execCallback} from 'node:child_process'
import startMainCommitFlow from '../src/prompter-manager.js'

const exec = promisify(execCallback)

/**
 * Get the list of modified files by the user
 * @param {object}  params
 * @param {boolean} params.checkIfStaged Determine if we should change if the modified file is staged
 */
const getDiffedFiles = ({checkIfStaged = false} = {}) => {
  let command = 'git diff --name-only'
  if (checkIfStaged) command += ' --cached'

  return exec(command).then(({stdout: files = ''}) => ({
    hasFiles: files.trim().length > 0,
    files
  }))
}

/**
 * Start the commiting process, doing some verifications to avoid further problems
 */
async function initCommit() {
  const {hasFiles: hasStagedFiles} = await getDiffedFiles({checkIfStaged: true})

  if (hasStagedFiles === false) {
    console.log('No files added to staging! Did you forget to run git add?\n')
    const modified = await getDiffedFiles()
    if (modified.hasFiles) {
      console.log('Showing the files that you could add:')
      console.log(modified.files)
    }
    return
  }

  startMainCommitFlow()
}

initCommit()
