module.exports = {
  presets: [
    ["@babel/preset-typescript"],
    ["@babel/preset-react"],
    ["@babel/preset-env"],
  ],
  plugins: [
    ["@babel/plugin-proposal-decorators", { decoratorsBeforeExport: true }],
    ["@babel/plugin-proposal-class-properties"],
    ["@babel/plugin-transform-modules-commonjs"],
    ["@babel/plugin-transform-arrow-functions"],
    ["@babel/plugin-transform-object-assign"],
    ["@babel/transform-runtime", { useESModules: false, regenerator: true }],
  ],
};
