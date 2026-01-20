import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'devtools/panel.js',
  output: {
    file: 'devtools/panel.bundle.js',
    format: 'iife',
    name: 'StreamPanel',
    sourcemap: false,
    globals: {
      chrome: 'chrome'
    }
  },
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs()
  ],
  external: ['chrome']  // chrome API 不打包
};
