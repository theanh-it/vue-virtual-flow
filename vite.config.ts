import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      processor: 'vue',
      tsconfigPath: './tsconfig.build.json',
      outDirs: [
        'dist',
        { dir: 'dist', moduleFormat: 'cjs' },
      ],
      cleanVueFileName: true,
      beforeWriteFile(filePath, content) {
        const moduleExtension = filePath.endsWith('.d.cts') ? '.cjs' : '.js'
        const rewriteSpecifier = (
          _match: string,
          prefix: string,
          specifier: string,
          suffix: string,
        ) => {
          const normalizedSpecifier = specifier.replace(
            /\.(?:vue|cjs|mjs|js)$/,
            '',
          )
          return `${prefix}${normalizedSpecifier}${moduleExtension}${suffix}`
        }
        const rewrittenContent = content
          .replace(
            /(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g,
            rewriteSpecifier,
          )
          .replace(
            /(import\(['"])(\.{1,2}\/[^'"]+)(['"]\))/g,
            rewriteSpecifier,
          )

        return { content: rewrittenContent }
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'VueVirtualScroll',
      fileName: (format) =>
        format === 'es' ? 'vue-virtual-flow.js' : 'vue-virtual-flow.cjs',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
        },
      },
    },
  },
})
