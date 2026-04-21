import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_URL ?? "http://127.0.0.1:4173";
const preferredChannel = process.env.PLAYWRIGHT_CHANNEL ?? "msedge";
const sampleCounts = [1, 4, 8, 16];
const softBudgetByParticipants = new Map([
  [1, 10],
  [4, 12],
  [8, 16.7],
]);

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
};

const samplePageRuntime = async (page) =>
  page.evaluate(async () => {
    const viewport = document.querySelector(".room-viewport");
    const canvas = document.querySelector(".room-viewport canvas");
    if (!(viewport instanceof HTMLDivElement) || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error("runtime viewport unavailable");
    }

    const frameTimes = [];
    let previous = performance.now();
    await new Promise((resolve) => {
      const step = (now) => {
        frameTimes.push(now - previous);
        previous = now;
        if (frameTimes.length >= 120) {
          resolve(undefined);
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    const averageFrameMs =
      frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;

    return {
      averageFrameMs,
      estimatedFps: Number((1000 / averageFrameMs).toFixed(2)),
      controlMode: viewport.dataset.controlMode ?? "ui",
      visibleOverlayCount: Number(viewport.dataset.visibleOverlayCount ?? "0"),
      activeDpr: Number((canvas.width / Math.max(canvas.clientWidth, 1)).toFixed(2)),
      viewportMode: viewport.dataset.viewportMode ?? "ui",
      runtimeLoadTier: viewport.dataset.runtimeLoadTier ?? "unknown",
      runtimeParticipantCount: Number(viewport.dataset.runtimeParticipantCount ?? "0"),
    };
  });

const main = async () => {
  const browser = await launchBrowser();
  const reports = [];

  try {
    for (const count of sampleCounts) {
      const context = await browser.newContext();
      const pages = [];

      for (let index = 0; index < count; index += 1) {
        const page = await context.newPage();
        pages.push(page);
        await joinRoom(page, `perf_${count}_${index + 1}`);
      }

      const runtimeSample = await samplePageRuntime(pages[0]);
      const softBudgetFrameMs = softBudgetByParticipants.get(count) ?? null;
      reports.push({
        participants: count,
        runtimeSample,
        softBudgetFrameMs,
        softBudgetStatus:
          softBudgetFrameMs === null
            ? "observe-only"
            : runtimeSample.averageFrameMs <= softBudgetFrameMs
              ? "within-budget"
              : "over-budget",
      });
      await context.close();
    }

    const outputDir = path.resolve(
      "C:/Users/HP/Desktop/WebGame/Chat/output/perf",
    );
    await mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "scene-runtime-samples.json");
    await writeFile(outputPath, JSON.stringify(reports, null, 2), "utf8");
    console.log(`scene runtime samples written to ${outputPath}`);
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
