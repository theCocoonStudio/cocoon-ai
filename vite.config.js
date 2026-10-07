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
      // two bundles: the package and its demos (src/demos.js), so a site that imports no demo carries none
      entry: { index: 'src/index.js', demos: 'src/demos.js' },
      formats: ['es'],
      fileName: (format, name) => `${name}.js`,
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
    // Sized for GitHub's runner under load, not for this machine: on 2026-10-05 the
    // logo export's "run writes the three files" (an SVG and a PNG rendered in-process)
    // passed the 5 s default here in under a second and exceeded it on the runner.
    // A faster runner only makes this more conservative.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    include: ['src/**/*.test.{js,jsx}', 'assets/**/*.test.js'],
  },
})
