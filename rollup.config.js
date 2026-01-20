import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const isProduction = process.env.NODE_ENV === 'production';

export default {
  input: 'devtools/panel.js',
  output: {
    file: 'devtools/panel.bundle.js',
    format: 'iife',
    name: 'StreamPanel',
    sourcemap: !isProduction,
    globals: {
      chrome: 'chrome'
    }
  },
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    ...(isProduction ? [terser()] : [])
  ],
  external: ['chrome']  // chrome API 不打包
};
