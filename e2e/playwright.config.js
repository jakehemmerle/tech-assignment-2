const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3939',
  },
  webServer: {
    command: 'npx serve ../bv-pages -l 3939 --no-clipboard',
    port: 3939,
    reuseExistingServer: !process.env.CI,
  },
});
