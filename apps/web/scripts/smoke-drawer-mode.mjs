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

const joinRoom = async (page, nickname) => {
  await page.goto(baseUrl, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector('.room-viewport[data-scene-mode="preview"] canvas', {
    state: "visible",
    timeout: 15000,
  });

  const joinInput = page.locator(".join-card input");
  if (await joinInput.isVisible().catch(() => false)) {
    await joinInput.fill(nickname);
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
    return (
      layout?.getAttribute("data-control-mode") === "look" &&
      layout?.getAttribute("data-drawer-open") === "false"
    );
  }, null, {
    timeout: 15000,
  });
};

const main = async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await joinRoom(page, "smoke_drawer");

    await page.keyboard.press("m");
    await page.waitForFunction(() => {
      const layout = document.querySelector(".app-layout");
      const drawer = document.querySelector(".room-drawer");
      return (
        layout?.getAttribute("data-control-mode") === "ui" &&
        layout?.getAttribute("data-drawer-open") === "true" &&
        drawer?.getAttribute("data-open") === "true"
      );
    }, null, {
      timeout: 5000,
    });
    await mkdir(screenshotDir, { recursive: true });
    await page.screenshot({
      path: path.join(screenshotDir, "visual-drawer-open.png"),
    });

    const drawerTextarea = page.locator(".room-drawer textarea").first();
    await drawerTextarea.waitFor({
      state: "visible",
      timeout: 5000,
    });
    await drawerTextarea.fill("smoke drawer chat");
    await page.locator(".room-drawer .chat-input-row button").last().click();
    await page.waitForSelector(".room-drawer .chat-item p", {
      state: "visible",
      timeout: 5000,
    });

    await page.locator(".room-drawer__close").click();
    await page.waitForFunction(() => {
      const layout = document.querySelector(".app-layout");
      const drawer = document.querySelector(".room-drawer");
      return (
        layout?.getAttribute("data-control-mode") === "look" &&
        layout?.getAttribute("data-drawer-open") === "false" &&
        drawer?.getAttribute("data-open") === "false"
      );
    }, null, {
      timeout: 5000,
    });

    console.log("smoke drawer-mode passed");
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
