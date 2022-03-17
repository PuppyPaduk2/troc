const path = require("path");
const NodeExternals = require("webpack-node-externals");
const NodemonPlugin = require("nodemon-webpack-plugin");

const cwd = process.cwd();

module.exports = () => ({
  mode: "development",
  target: "node",
  devtool: "source-map",
  entry: {
    run: path.resolve(cwd, "./src/run"),
    cli: path.resolve(cwd, "./src/cli"),
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)?$/,
        use: {
          loader: "babel-loader",
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js"],
    modules: [path.resolve(cwd, "./src"), path.resolve(cwd, "./node_modules")],
  },
  externals: [NodeExternals()],
  output: {
    filename: "[name].js",
    path: path.resolve(cwd, "./dist"),
  },
  watchOptions: {
    aggregateTimeout: 100,
  },
  plugins: [
    new NodemonPlugin({
      script: "./dist/run.js",
      watch: path.resolve("./dist"),
      delay: "200",
    }),
  ],
});
