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
    rollupOptions: {
      external,
      // Source files carry no directive (portable target); the single bundle gets it here so
      // a Next consumer sees a client boundary and a Vite consumer ignores it.
      output: { banner: "'use client';" },
    },
    sourcemap: true,
    minify: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
