// var chalk = require('chalk')
// console.log(chalk.bold.cyan.inverse('Processing Javascript files'))

const console = require('better-console')
const fs = require('mz/fs')

const path = require('path')
const { ncp } = require('ncp')
const recursiveReaddir = require('recursive-readdir')
const rimraf = require('rimraf')

var Browserify = require('browserify')
var uglify = require('uglify-js').minify

var filter = require('minimatch').filter

var SRC_PATH = path.join(__dirname, '..', 'src', 'scripts')
var DEST_PATH = path.join(__dirname, '..', 'src', 'metalsmith', 'scripts')
var BUILD_PATH = path.join(__dirname, '..', 'build', 'scripts')

var scripts = []

;(async () => {
  try {
    // remove destination path
    console.info('Cleaning up...')
    await rmdir(DEST_PATH)
    await fs.mkdir(DEST_PATH)
    // get source files
    const files = await rreaddir(SRC_PATH)
    // split files into includes and bundles
    const includes = files.filter(filter('**/includes/**/*.js'))
    const bundles = files.filter(filter('**/*.bundle.js'))
    // check filename collisions
    checkCollisions([...includes, ...bundles])
    // copy source of include files
    await Promise.all(includes.map(file => cp(
      file,
      path.join(DEST_PATH, path.basename(file))
    )))
    console.log('✓ Non-bundle files copied')
    // copy minified versions of include files
    const minifiedIncludes = await Promise.all(includes.map(minify))
    console.log('✓ Non-bundle files minified')
    // bundle files
    console.info('Bundling...')
    const minifiedBundles = await Promise.all(bundles.map(bundle))
    console.log('✓ Bundles bundled')
    // copy minified scripts and sourcemaps
    const minifiedScripts = [...minifiedBundles, ...minifiedIncludes]
    console.info('Copying minified scripts...')
    await Promise.all(minifiedScripts.map(async script => {
      await fs.writeFile(path.join(DEST_PATH, script.fileName), script.src)
      await fs.writeFile(path.join(DEST_PATH, script.fileName + '.map'), script.map)
    }))
    console.log('✓ Copied minified scripts')
    // copy to the build directory
    if (await fs.exists(BUILD_PATH)) {
      cp(DEST_PATH, BUILD_PATH)
    }
  } catch (err) {
    console.error(err)
  }
})()

async function rmdir (dir) {
  return new Promise((resolve, reject) => {
    rimraf(dir, (err) => {
      console.log(`Removed ${dir}`)
      if (err) return reject(new Error(err))
      return resolve()
    })
  })
}

async function rreaddir (directory) {
  return new Promise(function (resolve, reject) {
    recursiveReaddir(directory, function (err, files) {
      if (err) reject(err)
      resolve(files)
    })
  })
}

async function cp (source, destination) {
  return new Promise((resolve, reject) => {
    ncp(source, destination, (err) => {
      if (err) return reject(Error(err))
      return resolve()
    })
  })
}

function checkCollisions (files) {
  // error check to make sure we don't have any filename collisions
  files
    .map(file => path.basename(file))
    .reduce((acc, file) => {
      if (acc.includes(file)) throw new Error(`There is more than one script with the name ${file}`)
      acc.push(file)
      return acc
    }, [])
}

async function minify (file) {
  const data = await fs.readFile(file).then(d => d.toString())
  const fileName = path.basename(file).replace(/\.js$/, '.min.js')
  const minified = uglify(data, {
    sourceMap: {
      filename: fileName,
      url: `${fileName}.map`
    }
  })
  return {
    fileName,
    src: minified.code,
    map: minified.map
  }
}

function bundle (file) {
  return new Promise(function (resolve, reject) {
    var fileName = path.basename(file).replace('.bundle.js', '.min.js')
    console.info(`Creating ${fileName}`)
    // start browserify
    var browserify = new Browserify({ debug: true })
    // add the entry file to the queue
    browserify.add(file)
    // add minifier / sourcemap generator
    browserify.plugin('minifyify', { map: './' + fileName + '.map', minify: true })
    // call the main bundle function
    browserify.bundle(function (err, src, map) {
      if (err) reject(err)
      console.log(`Created ${fileName}`)
      resolve({ src, map, fileName })
    })
  })
}
