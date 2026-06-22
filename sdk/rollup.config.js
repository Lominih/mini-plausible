import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/plausible.min.js',
      format: 'iife',
      name: 'Plausible',
      sourcemap: false,
      plugins: [terser({ format: { comments: false } })],
    },
    {
      file: 'dist/plausible.esm.js',
      format: 'es',
      sourcemap: false,
      plugins: [terser({ format: { comments: false } })],
    },
  ],
  plugins: [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
    }),
  ],
};