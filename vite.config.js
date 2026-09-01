import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { peerDependencies } from './package.json' with { type: 'json' }

// Anything the consuming app already provides must not be bundled into the lib.
const peers = Object.keys(peerDependencies)
const external = [
  ...peers,
  ...peers.map((name) => new RegExp(`^${name}/`)),
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
]

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    lib: {
      entry: 'src/index.js',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: { external },
    sourcemap: true,
    minify: true,
  },
})
