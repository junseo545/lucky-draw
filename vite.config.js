import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
})
