import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = "C:\\Users\\yahir\\.gemini\\antigravity\\brain\\19a5affc-a90f-4005-b4f7-a7b6f00a3de2\\screenshots";

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "desktop_1920x1080", width: 1920, height: 1080 },
    { name: "laptop_1366x768", width: 1366, height: 768 },
    { name: "tablet_768x1024", width: 768, height: 1024 },
    { name: "mobile_375x812", width: 375, height: 812 },
  ];

  for (const vp of viewports) {
    console.log(`[Screenshot] Capturing ${vp.name}...`);
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
    });

    // 1. Home Page (Assistant Closed)
    await page.goto("http://localhost:3100", { waitUntil: "networkidle" }).catch(() => {});
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_home_closed.png`), fullPage: false });

    // 2. Home Page (Assistant Open)
    const assistantBtn = page.locator("#floating-legal-btn");
    if (await assistantBtn.isVisible()) {
      await assistantBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_home_assistant_open.png`), fullPage: false });

      // Close assistant
      const closeBtn = page.locator('button[aria-label="Cerrar asistente legal"]');
      if (await closeBtn.isVisible()) await closeBtn.click();
    }

    // 3. Machotes Page & Modal
    await page.goto("http://localhost:3100/legal-hub/machotes", { waitUntil: "networkidle" }).catch(() => {});
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_machotes.png`), fullPage: false });

    await page.close();
  }

  await browser.close();
  console.log(`[Screenshot] All screenshots saved to ${SCREENSHOT_DIR}`);
}

main().catch((err) => {
  console.error("[Screenshot] Error:", err);
  process.exit(1);
});
