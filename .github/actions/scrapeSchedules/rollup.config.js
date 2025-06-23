// rollup.config.js (más compatible)
const commonjs = require('@rollup/plugin-commonjs');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const json = require('@rollup/plugin-json');

module.exports = {
  input: 'src/index.js',
  output: {
    file: 'dist/index.js',
    format: 'es',
    esModule: true,
    sourcemap: true,
  },
  plugins: [commonjs(), nodeResolve({ preferBuiltins: true }), json()],
};
