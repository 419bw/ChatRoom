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

const getViewportDebug = async (page) =>
  page.evaluate(() => {
    const viewport = document.querySelector(".room-viewport");
    if (!(viewport instanceof HTMLDivElement)) {
      throw new Error("room viewport unavailable");
    }

    return {
      controlMode: viewport.dataset.controlMode ?? "ui",
      pointerLock: viewport.dataset.pointerLock ?? "false",
      dragLook: viewport.dataset.dragLook ?? "false",
      cameraYaw: Number(viewport.dataset.cameraYaw ?? "0"),
      cameraPitch: Number(viewport.dataset.cameraPitch ?? "0"),
      localMotion: viewport.dataset.localMotion ?? "idle",
    };
  });

const pressMoveCombo = async (page, keys, durationMs) => {
  for (const key of keys) {
    await page.keyboard.down(key);
  }

  await page.waitForTimeout(durationMs);

  for (const key of [...keys].reverse()) {
    await page.keyboard.up(key);
  }
};

const getActiveHotspotId = async (page) =>
  page.evaluate(() => {
    const viewport = document.querySelector(".room-viewport");
    return viewport?.getAttribute("data-hotspot-id") ?? "";
  });

const reachSofaCornerHotspot = async (page) => {
  const searchPlan = [
    { keys: ["a", "s"], durationMs: 340 },
    { keys: ["a"], durationMs: 220 },
    { keys: ["s"], durationMs: 220 },
    { keys: ["a", "s"], durationMs: 220 },
    { keys: ["a"], durationMs: 160 },
    { keys: ["s"], durationMs: 180 },
    { keys: ["a", "s"], durationMs: 160 },
  ];

  for (const step of searchPlan) {
    await pressMoveCombo(page, step.keys, step.durationMs);
    await page.waitForTimeout(140);

    if ((await getActiveHotspotId(page)) === "sofa-corner") {
      return true;
    }
  }

  return false;
};

const main = async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await joinRoom(page, "smoke_look");
    await mkdir(screenshotDir, { recursive: true });

    const viewport = page.locator(".room-viewport");
    await viewport.click({
      position: {
        x: 220,
        y: 180,
      },
    });

    await page.waitForFunction(() => {
      const viewportNode = document.querySelector(".room-viewport");
      const layout = document.querySelector(".app-layout");
      return (
        viewportNode?.getAttribute("data-control-mode") === "look" &&
        layout?.getAttribute("data-drawer-open") === "false"
      );
    }, null, {
      timeout: 5000,
    });

    const hotspotReached = await reachSofaCornerHotspot(page);
    if (!hotspotReached) {
      throw new Error("failed to reach sofa-corner hotspot");
    }

    await page.waitForSelector(
      '.room-viewport__hotspot-card[data-hotspot-id="sofa-corner"]',
      {
        state: "visible",
        timeout: 5000,
      },
    );
    await page.screenshot({
      path: path.join(screenshotDir, "visual-hotspot-nearby.png"),
    });

    await page.keyboard.press("f");
    await page.waitForFunction(() => {
      const viewport = document.querySelector(".room-viewport");
      return (
        viewport?.getAttribute("data-hotspot-id") === "sofa-corner" &&
        viewport?.getAttribute("data-hotspot-selected") === "true"
      );
    }, null, {
      timeout: 5000,
    });
    await page.screenshot({
      path: path.join(screenshotDir, "visual-hotspot-selected.png"),
    });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => {
      const viewport = document.querySelector(".room-viewport");
      return viewport?.getAttribute("data-hotspot-selected") === "false";
    }, null, {
      timeout: 5000,
    });

    const before = await getViewportDebug(page);
    if (before.pointerLock === "true") {
      await page.mouse.move(480, 260);
      await page.mouse.move(620, 320);
    } else {
      const box = await viewport.boundingBox();
      if (!box) {
        throw new Error("room viewport bounding box unavailable");
      }

      const startX = box.x + box.width * 0.42;
      const startY = box.y + box.height * 0.42;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 110, startY + 42, {
        steps: 6,
      });
      await page.mouse.move(startX + 180, startY + 4, {
        steps: 6,
      });
      await page.mouse.up();
    }

    await page.waitForTimeout(160);
    const after = await getViewportDebug(page);
    const yawDelta = Math.abs(after.cameraYaw - before.cameraYaw);
    const pitchDelta = Math.abs(after.cameraPitch - before.cameraPitch);

    if (yawDelta <= 0.01 && pitchDelta <= 0.01) {
      throw new Error(
        `look-mode failed: before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`,
      );
    }

    await page.keyboard.press("Enter");
    await page.waitForSelector(".room-viewport__chat-overlay textarea", {
      state: "visible",
      timeout: 5000,
    });
    await page.locator(".room-viewport__chat-overlay textarea").fill("smoke reenter");
    await page.keyboard.press("Enter");

    await page.waitForFunction(() => {
      const viewportNode = document.querySelector(".room-viewport");
      const layout = document.querySelector(".app-layout");
      return (
        viewportNode?.getAttribute("data-control-mode") === "look" &&
        layout?.getAttribute("data-drawer-open") === "false"
      );
    }, null, {
      timeout: 5000,
    });

    await page.keyboard.down("d");
    await page.waitForFunction(() => {
      const viewportNode = document.querySelector(".room-viewport");
      return viewportNode?.getAttribute("data-local-motion") === "walking";
    }, null, {
      timeout: 5000,
    });
    await page.keyboard.up("d");

    console.log("smoke look-mode passed");
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
