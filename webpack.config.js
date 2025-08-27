const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

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
  },

  devtool: 'source-map',

  devServer: {
    static: [
      { directory: path.resolve(__dirname, 'public') }, // optional extra static
    ],
    port: 8080,
    open: ['/game.html'],
    hot: true,
    liveReload: true,
  },

  module: {
    rules: [
      { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
      {
        test: /\.(png|svg|jpg|jpeg|gif|webp|mp3|wav|ogg)$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/[name][ext]' },
      },
      // Let JSON imports be normal JSON modules (default)
      { test: /\.json$/i, type: 'json' },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      chunks: ['main'],
      filename: 'index.html',
      favicon: './logo.png',
      inject: 'body',
    }),
    new HtmlWebpackPlugin({
      template: './src/game/game.html',
      chunks: ['game'],
      filename: 'game.html',
      favicon: './logo.png',
      inject: 'body',
    }),
  ],
};
