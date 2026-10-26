const { defineConfig } = require('@playwright/test');

// BASE_URL=https://dopelganger.netlify.app npx playwright test  runs against the live site.
const live = process.env.BASE_URL;

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30000,
    fullyParallel: true,
    reporter: [['list']],
    use: {
        baseURL: live || 'http://localhost:8342',
        timezoneId: 'America/New_York',
        locale: 'en-US',
        viewport: { width: 1280, height: 900 }
    },
    webServer: live ? undefined : {
        command: 'node serve.js 8342',
        url: 'http://localhost:8342',
        reuseExistingServer: true
    }
});
