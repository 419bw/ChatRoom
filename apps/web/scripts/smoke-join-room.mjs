import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_URL ?? "http://127.0.0.1:4173";
const preferredChannel = process.env.PLAYWRIGHT_CHANNEL ?? "msedge";
const screenshotDir = path.resolve("../../output/playwright");

const launchBrowser = async () => {
  try {
    return await chromium.launch({
      channel: preferredChannel,
      headless: true,
    });
  } catch {
    return chromium.launch({
      headless: true,
    });
  }
};

const main = async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  const issues = [];

  page.on("pageerror", (error) => {
    issues.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    const text = message.text();
    if (text.includes("favicon.ico")) {
      return;
    }
    issues.push(`console error: ${text}`);
  });

  try {
    await page.goto(baseUrl, {
      waitUntil: "networkidle",
    });

    await page.waitForSelector('.room-viewport[data-scene-mode="preview"] canvas', {
      state: "visible",
      timeout: 15000,
    });

    const joinInput = page.locator(".join-card input");
    const needsJoin = await joinInput
      .waitFor({
        state: "visible",
        timeout: 5000,
      })
      .then(() => true)
      .catch(() => false);

    if (needsJoin) {
      await joinInput.fill("smoke_join");
      await page.locator(".join-footer button").click({
        noWaitAfter: true,
      });
    }

    await page.waitForFunction(() => !document.querySelector(".join-overlay"), null, {
      timeout: 15000,
    });
    await page.waitForSelector('.room-viewport[data-scene-mode="r3f"][data-scene-ready="true"] canvas', {
      state: "visible",
      timeout: 15000,
    });
    await page.waitForFunction(() => {
      const layout = document.querySelector(".app-layout");
      const drawer = document.querySelector(".room-drawer");
      return (
        layout?.getAttribute("data-control-mode") === "look" &&
        layout?.getAttribute("data-drawer-open") === "false" &&
        drawer?.getAttribute("data-open") === "false"
      );
    }, null, {
      timeout: 15000,
    });
    await mkdir(screenshotDir, { recursive: true });
    await page.screenshot({
      path: path.join(screenshotDir, "visual-look-default.png"),
    });

    if (issues.some((issue) => issue.includes("pageerror"))) {
      throw new Error(issues.join("\n"));
    }

    console.log("smoke join-room passed");
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
