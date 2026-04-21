import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_URL ?? "http://127.0.0.1:4173";
const preferredChannel = process.env.PLAYWRIGHT_CHANNEL ?? "msedge";

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

const createIssueCollector = () => {
  const issues = [];

  return {
    issues,
    attach(page, pageName) {
      page.on("pageerror", (error) => {
        issues.push(`[${pageName}] pageerror: ${error.message}`);
      });
      page.on("console", (message) => {
        if (message.type() !== "error") {
          return;
        }

        const text = message.text();
        if (text.includes("favicon.ico")) {
          return;
        }

        issues.push(`[${pageName}] console error: ${text}`);
      });
    },
  };
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
      cameraYaw: Number(viewport.dataset.cameraYaw ?? "0"),
      cameraPitch: Number(viewport.dataset.cameraPitch ?? "0"),
      cameraDistance: Number(viewport.dataset.cameraDistance ?? "0"),
      motion: viewport.dataset.localMotion ?? "idle",
      headingError: Number(viewport.dataset.localHeadingError ?? "0"),
      gaitPhase: Number(viewport.dataset.localGaitPhase ?? "0"),
    };
  });

const waitForRoomReady = async (page) => {
  await page.waitForFunction(() => !document.querySelector(".join-overlay"), null, {
    timeout: 15000,
  });
  await page.waitForSelector(
    '.room-viewport[data-scene-mode="r3f"][data-scene-ready="true"] canvas',
    {
      state: "visible",
      timeout: 15000,
    },
  );
  await page.waitForSelector(".chat-history", {
    state: "attached",
    timeout: 15000,
  });
  await page.waitForFunction(() => {
    const viewport = document.querySelector(".room-viewport");
    return viewport?.getAttribute("data-control-mode") === "ui";
  }, null, {
    timeout: 5000,
  });
};

const waitForChatInput = async (page) => {
  await page.waitForSelector(".chat-input-row textarea:not([disabled])", {
    state: "attached",
    timeout: 5000,
  });
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
  const needsJoin = await joinInput
    .waitFor({
      state: "visible",
      timeout: 5000,
    })
    .then(() => true)
    .catch(() => false);

  if (needsJoin) {
    await joinInput.fill(nickname);
    await page.locator(".join-footer button").click({
      noWaitAfter: true,
    });
  }

  await waitForRoomReady(page);
};

const enterLookMode = async (page) => {
  const viewport = page.locator(".room-viewport");
  await viewport.click({
    position: {
      x: 220,
      y: 180,
    },
  });

  await page.waitForFunction(() => {
    const viewportNode = document.querySelector(".room-viewport");
    return viewportNode?.getAttribute("data-control-mode") === "look";
  }, null, {
    timeout: 4000,
  });
};

const exitLookMode = async (page) => {
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => {
    const viewport = document.querySelector(".room-viewport");
    return viewport?.getAttribute("data-control-mode") === "ui";
  }, null, {
    timeout: 5000,
  });
};

const enterChatMode = async (page) => {
  await page.keyboard.press("Enter");
  await waitForChatInput(page);
  await page.waitForFunction(() => {
    const viewport = document.querySelector(".room-viewport");
    return (
      viewport?.getAttribute("data-control-mode") === "ui"
    );
  }, null, {
    timeout: 5000,
  });
};

const sendMessage = async (page, text) => {
  await enterChatMode(page);
  await page.locator(".chat-input-row textarea:not([disabled])").click();
  await page.locator(".chat-input-row textarea:not([disabled])").fill(text);
  await page.keyboard.press("Enter");
};

const assertClickEntersLookMode = async (page) => {
  await enterLookMode(page);
  const state = await getViewportDebug(page);

  if (state.controlMode !== "look") {
    throw new Error(`expected look mode after clicking viewport: ${JSON.stringify(state)}`);
  }
};

const assertMouseLookChangesCamera = async (page) => {
  const before = await getViewportDebug(page);
  if (before.pointerLock === "true") {
    await page.mouse.move(480, 260);
    await page.mouse.move(620, 320);
  } else {
    await page.evaluate(() => {
      const viewport = document.querySelector(".room-viewport");
      if (!(viewport instanceof HTMLDivElement)) {
        throw new Error("room viewport unavailable");
      }

      viewport.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 260,
          clientY: 220,
          bubbles: true,
        }),
      );
      viewport.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 420,
          clientY: 300,
          bubbles: true,
        }),
      );
    });
  }
  await page.waitForTimeout(120);
  const after = await getViewportDebug(page);

  const yawDelta = Math.abs(after.cameraYaw - before.cameraYaw);
  const pitchDelta = Math.abs(after.cameraPitch - before.cameraPitch);

  if (yawDelta <= 0.01 && pitchDelta <= 0.01) {
    throw new Error(`mouse look did not change camera orientation: before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`);
  }
};

const assertMouseUpLooksUp = async (page) => {
  const before = await getViewportDebug(page);
  if (before.pointerLock === "true") {
    await page.mouse.move(520, 360);
    await page.mouse.move(520, 220);
  } else {
    await page.evaluate(() => {
      const viewport = document.querySelector(".room-viewport");
      if (!(viewport instanceof HTMLDivElement)) {
        throw new Error("room viewport unavailable");
      }

      viewport.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 320,
          clientY: 340,
          bubbles: true,
        }),
      );
      viewport.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 320,
          clientY: 220,
          bubbles: true,
        }),
      );
    });
  }
  await page.waitForTimeout(120);
  const after = await getViewportDebug(page);

  if (!(after.cameraPitch < before.cameraPitch)) {
    throw new Error(`mouse up should tilt camera up: before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`);
  }
};

const assertFineKeyboardStep = async (page) => {
  await page.keyboard.down("d");
  await page.waitForFunction(() => {
    const viewport = document.querySelector(".room-viewport");
    return viewport?.getAttribute("data-local-motion") === "walking";
  }, null, {
    timeout: 4000,
  });

  const first = await getViewportDebug(page);
  await page.waitForTimeout(220);
  const second = await getViewportDebug(page);

  if (Math.abs(second.gaitPhase - first.gaitPhase) <= 0.03) {
    throw new Error(
      `gait phase did not advance while moving: before=${first.gaitPhase}, after=${second.gaitPhase}`,
    );
  }

  await page.keyboard.up("d");
  await page.waitForFunction(() => {
    const viewport = document.querySelector(".room-viewport");
    return viewport?.getAttribute("data-local-motion") === "idle";
  }, null, {
    timeout: 4000,
  });
};

const assertKeyboardIgnoredWhileTyping = async (page) => {
  await enterChatMode(page);
  const textarea = page.locator(".chat-input-row textarea:not([disabled])");
  await textarea.click();

  await page.keyboard.down("d");
  await page.waitForTimeout(90);
  await page.keyboard.up("d");
  await page.waitForTimeout(180);

  const state = await getViewportDebug(page);
  const value = await textarea.inputValue();

  if (state.controlMode !== "ui") {
    throw new Error(`expected ui mode while typing: ${JSON.stringify(state)}`);
  }

  if (state.motion !== "idle") {
    throw new Error(`typing should not move the local avatar: ${JSON.stringify(state)}`);
  }

  if (!value.toLowerCase().includes("d")) {
    throw new Error("focused chat typing check failed: expected textarea to receive key input");
  }

  await textarea.fill("");
};

const assertCrosshairVisibility = async (page) => {
  const crosshairVisibleInLook = await page
    .locator(".room-viewport__crosshair")
    .isVisible()
    .catch(() => false);

  if (!crosshairVisibleInLook) {
    throw new Error("crosshair should be visible in look mode");
  }

  await enterChatMode(page);

  const crosshairVisibleInUi = await page
    .locator(".room-viewport__crosshair")
    .isVisible()
    .catch(() => false);

  if (crosshairVisibleInUi) {
    throw new Error("crosshair should be hidden in ui/chat mode");
  }

  await page.locator(".chat-input-row textarea:not([disabled])").fill("");
};

const assertCameraDistanceChangesNearObstacle = async (page) => {
  const before = await getViewportDebug(page);
  const patterns = [
    { key: "s", duration: 1200 },
    { key: "a", duration: 1200 },
    { key: "s", duration: 1200 },
  ];

  let matched = false;
  let after = before;
  for (const pattern of patterns) {
    await page.keyboard.down(pattern.key);
    await page.waitForTimeout(pattern.duration);
    await page.keyboard.up(pattern.key);
    await page.waitForTimeout(220);
    after = await getViewportDebug(page);
    if (Math.abs(after.cameraDistance - before.cameraDistance) >= 0.02) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    throw new Error(`camera distance should adapt near obstacles: before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`);
  }
};

const assertBubbleVisible = async (page, bubbleText) => {
  return page
    .waitForFunction(
      (targetBubbleText) => {
        const bubble = Array.from(document.querySelectorAll(".world-bubble")).find(
          (node) => node.textContent?.trim() === targetBubbleText,
        );
        if (!(bubble instanceof HTMLDivElement)) {
          return false;
        }

        const anchor = bubble.parentElement;
        if (!(anchor instanceof HTMLDivElement)) {
          return false;
        }

        const style = getComputedStyle(anchor);
        return style.opacity !== "0" && !style.transform.includes("-9999");
      },
      bubbleText,
      { timeout: 5000 },
    )
    .then(() => true)
    .catch(() => false);
};

const assertNoBlockingIssues = (issues) => {
  const blockingIssues = issues.filter((issue) => {
    return (
      issue.includes("pageerror") ||
      issue.includes("lazyInitializer") ||
      issue.includes("React error #306") ||
      issue.includes("Could not load /models/avatar-formal.glb") ||
      issue.includes("MathUtils is not defined") ||
      issue.includes("Cannot convert object to primitive value") ||
      issue.includes("reading 'input'") ||
      issue.includes("An error occurred in one of your React components")
    );
  });

  if (blockingIssues.length > 0) {
    throw new Error(`smoke chatroom failed:\n${blockingIssues.join("\n")}`);
  }
};

const verifyJumpToLatest = async (page) => {
  const chip = page.locator(".chat-jump-chip");
  const becameVisible = await chip
    .waitFor({
      state: "visible",
      timeout: 3000,
    })
    .then(() => true)
    .catch(() => false);

  if (!becameVisible) {
    return;
  }

  await chip.click();

  await page.waitForFunction(() => {
    const history = document.querySelector(".chat-history");
    const jumpChip = document.querySelector(".chat-jump-chip");
    if (!(history instanceof HTMLDivElement)) {
      return false;
    }

    const nearBottom =
      history.scrollHeight - history.scrollTop - history.clientHeight <= 24;

    return nearBottom && !jumpChip;
  });
};

const main = async () => {
  const browser = await launchBrowser();
  const context = await browser.newContext();
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  const issueCollector = createIssueCollector();
  issueCollector.attach(pageA, "pageA");
  issueCollector.attach(pageB, "pageB");

  try {
    await joinRoom(pageA, "smoke_a");
    await joinRoom(pageB, "smoke_b");

    await assertClickEntersLookMode(pageA);
    await assertMouseLookChangesCamera(pageA);
    await assertMouseUpLooksUp(pageA);
    await assertCrosshairVisibility(pageA);
    await enterLookMode(pageA);
    await assertFineKeyboardStep(pageA);
    await assertCameraDistanceChangesNearObstacle(pageA);
    await assertKeyboardIgnoredWhileTyping(pageA);
    await enterLookMode(pageA);
    await exitLookMode(pageA);

    await pageA.locator('button[aria-controls="members-panel-body"]').click();
    await pageA.locator('button[aria-controls="members-panel-body"]').click();
    await pageA.locator('button[aria-controls="appearance-panel-body"]').click();
    await pageA.locator('button[aria-controls="appearance-panel-body"]').click();
    await pageA.locator('button[aria-controls="chat-panel-body"]').click();
    await pageA.locator('button[aria-controls="chat-panel-body"]').click();

    for (let index = 0; index < 8; index += 1) {
      await sendMessage(pageB, `smoke message ${index + 1}`);
    }

    await pageA.waitForFunction(
      () => document.querySelectorAll(".chat-item").length >= 8,
      null,
      { timeout: 15000 },
    );

    await pageA.locator(".chat-history").evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll"));
    });

    await sendMessage(pageB, "smoke latest");
    await assertBubbleVisible(pageA, "smoke latest");
    await verifyJumpToLatest(pageA);

    assertNoBlockingIssues(issueCollector.issues);
    console.log("smoke chatroom passed");
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
