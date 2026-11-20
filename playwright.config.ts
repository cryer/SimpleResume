import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests/browser',use:{channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge', baseURL:'http://127.0.0.1:5173',acceptDownloads:true},webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:false}})
