/* eslint-disable no-console */
const webpack = require('webpack')
const path = require('path')

const HtmlWebpackPlugin = require('html-webpack-plugin')
const ManifestPlugin = require('webpack-manifest-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin')

const {when, cleanList, envVars, MAIN_ENTRY_POINT, config} = require('./shared')
const minifyJs = require('./shared/minify-js')
const definePlugin = require('./shared/define')
const babelRules = require('./shared/module-rules-babel')
const {splitChunks} = require('./shared/optimization-split-chunks')
const {sourceMap} = require('./shared/config')
const parseAlias = require('./shared/parse-alias')

const Externals = require('./plugins/externals')
const LoaderUniversalOptionsPlugin = require('./plugins/loader-options')

const PUBLIC_PATH = process.env.CDN || config.cdn || '/'

const filename = config.onlyHash
  ? '[contenthash:8].js'
  : '[name].[contenthash:8].js'

module.exports = {
  devtool: sourceMap,
  mode: 'production',
  context: path.resolve(process.cwd(), 'src'),
  resolve: {
    alias: parseAlias(config.alias),
    extensions: ['*', '.js', '.jsx', '.json']
  },
  entry: config.vendor
    ? {
        app: MAIN_ENTRY_POINT,
        vendor: config.vendor
      }
    : MAIN_ENTRY_POINT,
  target: 'web',
  output: {
    chunkFilename: filename,
    filename,
    path: path.resolve(process.env.PWD, 'public'),
    publicPath: PUBLIC_PATH
  },
  optimization: {
    minimizer: [
      minifyJs(sourceMap),
      new OptimizeCSSAssetsPlugin({
        cssProcessorOptions: {}
      })
    ],
    runtimeChunk: true,
    splitChunks
  },
  plugins: cleanList([
    new webpack.HashedModuleIdsPlugin(),
    new webpack.EnvironmentPlugin(envVars(config.env)),
    definePlugin(),
    new MiniCssExtractPlugin({
      filename: config.onlyHash
        ? '[contenthash:8].css'
        : '[name].[contenthash:8].css',
      chunkFilename: config.onlyHash
        ? '[contenthash:8].css'
        : '[id].[contenthash:8].css'
    }),
    new HtmlWebpackPlugin({
      env: process.env,
      inject: 'head',
      template: './index.html',
      trackJSToken: '',
      minify: {
        collapseWhitespace: true,
        keepClosingSlash: true,
        minifyCSS: true,
        minifyURLs: true,
        removeEmptyAttributes: true,
        removeRedundantAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true
      }
    }),
    new ScriptExtHtmlWebpackPlugin(
      Object.assign(
        {
          defaultAttribute: 'defer',
          inline: 'runtime',
          prefetch: {
            test: /\.js$/,
            chunks: 'all'
          }
        },
        config.scripts
      )
    ),
    new ManifestPlugin({
      fileName: 'asset-manifest.json'
    }),
    when(config.externals, () => new Externals({files: config.externals})),
    new LoaderUniversalOptionsPlugin(require('./shared/loader-options'))
  ]),
  module: {
    rules: cleanList([
      babelRules,
      {
        test: /(\.css|\.scss)$/,
        use: cleanList([
          MiniCssExtractPlugin.loader,
          require.resolve('css-loader'),
          when(config['externals-manifest'], () => ({
            loader: 'externals-manifest-loader',
            options: {
              manifestURL: config['externals-manifest']
            }
          })),
          require.resolve('postcss-loader'),
          require.resolve('sass-loader')
        ])
      }
    ])
  },
  node: {
    fs: 'empty',
    net: 'empty',
    tls: 'empty'
  }
}
