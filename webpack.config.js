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
    path: path.resolve(__dirname, 'dist'), // v3 will serve from memory; this is for prod build
    clean: true,
  },

  devtool: 'source-map',

  // ✅ v3 syntax
  devServer: {
    contentBase: path.resolve(__dirname, 'public'),
    port: 8080,
    open: true,       // (v3 doesn't support array form)
    hot: true,
    overlay: true,    // show build errors in the browser (v3 feature)
    historyApiFallback: false,
  },

  module: {
    rules: [
      { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
      {
        test: /\.(png|svg|jpg|jpeg|gif|webp|mp3|wav|ogg)$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/[name][ext]' },
      },
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
