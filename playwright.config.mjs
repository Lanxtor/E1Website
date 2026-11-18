// Screen tests of the website (docs/TESTS.md): npm run test:e2e
import { defineConfig, devices } from "@playwright/test";
import net from "node:net";

/* A free port, chosen once: the workers inherit it through the environment. */
async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}
if (!process.env.E1_TEST_PORT) process.env.E1_TEST_PORT = String(await freePort());
const PORT = Number(process.env.E1_TEST_PORT);

/* E1_CHROMIUM: a Chromium of another version than @playwright/test expects
   (for example /opt/pw-browsers/chromium in a container where it is pre-installed). */
const launchOptions = process.env.E1_CHROMIUM ? { executablePath: process.env.E1_CHROMIUM } : {};

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.mjs",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "en-US",
    timezoneId: "America/New_York",
    trace: "off",
    launchOptions
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    // The keyboard tests need a keyboard: desktop only.
    { name: "phone", use: { ...devices["iPhone 15"], browserName: "chromium" }, testIgnore: /keyboard\.spec\.mjs$/ }
  ],
  webServer: {
    command: `node tests/e2e/server.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
    stdout: "ignore"
  }
});
