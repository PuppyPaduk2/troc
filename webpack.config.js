const path = require("path");
const NodeExternals = require("webpack-node-externals");
const NodemonPlugin = require("nodemon-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

const ShellPlugin = require("./utils/shell-plugin");

const cwd = process.cwd();

module.exports = ({ proxyServer, registryServer }) => ({
  mode: "development",
  target: "node",
  devtool: "source-map",
  entry: Object.assign(
    {
      cli: path.resolve(cwd, "./src/cli/v2"),
    },
    proxyServer && {
      "run-proxy-server": path.resolve(cwd, "./src/run-proxy-server"),
    },
    registryServer && {
      "run-registry-server": path.resolve(cwd, "./src/run-registry-server"),
    }
  ),
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
    proxyServer &&
      new NodemonPlugin({
        script: "./dist/run-proxy-server.js",
        watch: path.resolve("./dist/run-proxy-server.js"),
        delay: "200",
      }),
    registryServer &&
      new NodemonPlugin({
        script: "./dist/run-registry-server.js",
        watch: path.resolve("./dist/run-registry-server.js"),
        delay: "200",
      }),
    new ShellPlugin("emit", "node ./scripts/after-build.js"),
    new ForkTsCheckerWebpackPlugin(),
  ].filter(Boolean),
});
