import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ★ GitHubリポジトリ名に合わせて変更してください
// 例: リポジトリが https://github.com/yourname/kisaki-db なら '/kisaki-db/'
const REPO_NAME = '/Imomushi_Hanemushi_Teams/'

export default defineConfig({
  plugins: [react()],
  base: REPO_NAME,
})
