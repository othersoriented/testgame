// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  entry: {
    main: './src/index.js',
    game: './src/game/game.js',
  },

  output: {
    filename: '[name].[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    environment: { dynamicImport: true },
  },

  devtool: 'source-map',

  // Dev server (Webpack Dev Server v4 syntax)
  devServer: {
    static: { directory: path.resolve(__dirname, 'dist') },
    port: 8080,
    open: true,
    hot: true,
    client: { overlay: true },
    historyApiFallback: false,
  },

  module: {
    rules: [
      { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
      {
        test: /\.(png|svg|jpg|jpeg|gif|webp|mp3|wav|ogg|mp4|webm)$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/[name][ext]' },
      },
      { test: /\.json$/i, type: 'json' },
    ],
  },

  plugins: [
    // Landing page → dist/index.html
    new HtmlWebpackPlugin({
      template: './src/index.html',
      chunks: ['main'],
      filename: 'index.html',
      favicon: './logo.png',
      inject: 'body',
    }),
    // Phaser game page → dist/game.html
    new HtmlWebpackPlugin({
      template: './src/game/game.html',
      chunks: ['game'],
      filename: 'game.html',
      favicon: './logo.png',
      inject: 'body',
    }),
    // Copy Lyric Ninja folder (tolerate missing on older commits)
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/BlockNinja'),
          to: 'ninja',
          noErrorOnMissing: true,
        },
        // Shared content (manifest + assets placed under /content)
        {
          from: path.resolve(__dirname, 'content'),
          to: 'content',
          noErrorOnMissing: true,
        },
        // Ensure the Phaser lyrics JSON is available to both games at /content/psalm150/lyrics.json
        {
          from: path.resolve(__dirname, 'src/game/assets/data/lyrics.json'),
          to: 'content/psalm150/lyrics.json',
          noErrorOnMissing: true,
        },
        // Copy top-level assets/ into /assets so manifest audio like /assets/audio/*.mp3 resolves
        {
          from: path.resolve(__dirname, 'assets'),
          to: 'assets',
          noErrorOnMissing: true,
        },
      ],
    }),
  ],

  resolve: {
    extensions: ['.js', '.json'],
  },
};
