const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30000,
    fullyParallel: true,
    reporter: [['list']],
    use: {
        baseURL: 'http://localhost:8342',
        timezoneId: 'America/New_York',
        locale: 'en-US',
        viewport: { width: 1280, height: 900 }
    },
    webServer: {
        command: 'node serve.js 8342',
        url: 'http://localhost:8342',
        reuseExistingServer: true
    }
});
