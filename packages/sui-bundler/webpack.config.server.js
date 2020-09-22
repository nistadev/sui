const webpack = require('webpack')
const webpackNodeExternals = require('webpack-node-externals')
const path = require('path')
const babelRules = require('./shared/module-rules-babel')
const parseAlias = require('./shared/parse-alias')

const {config, cleanList} = require('./shared')

const webpackConfig = {
  context: path.resolve(process.cwd(), 'src'),
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  resolve: {
    alias: parseAlias(config.alias),
    extensions: ['*', '.js', '.jsx', '.json']
  },
  entry: './server.js',
  target: 'node',
  output: {
    path: path.resolve(process.cwd(), 'build'),
    chunkFilename: '[name].[chunkhash:8].js',
    filename: '[name].[chunkhash:8].js'
  },
  optimization: {
    nodeEnv: false
  },
  externals: [webpackNodeExternals()],
  plugins: [new webpack.DefinePlugin({'global.GENTLY': false})],
  module: {
    rules: cleanList([
      babelRules,
      {
        // ignore css/scss require/imports files in the server
        test: /\.s?css$/,
        use: ['null-loader']
      }
    ])
  }
}

module.exports = webpackConfig
