import { describe, expect, test } from "vitest";

import { resolveSceneQualityProfile } from "./sceneQuality";
import {
  resolveRuntimeActorFidelity,
  resolveRuntimeLoadTier,
  resolveRuntimeOverlayPriorities,
  resolveRuntimeScenePolicy,
} from "./runtimeScenePolicy";

const createUser = (
  userId: string,
  x: number,
  y: number,
  lastActiveAt: number,
) => ({
  userId,
  nickname: userId,
  avatar: {
    cosmetic: "mint" as const,
  },
  position: {
    x,
    y,
  },
  joinedAt: 1000,
  lastActiveAt,
});

describe("runtimeScenePolicy", () => {
  test("人数会落到正确的运行时档位", () => {
    expect(resolveRuntimeLoadTier(1)).toBe("normal");
    expect(resolveRuntimeLoadTier(4)).toBe("normal");
    expect(resolveRuntimeLoadTier(5)).toBe("crowded");
    expect(resolveRuntimeLoadTier(8)).toBe("crowded");
    expect(resolveRuntimeLoadTier(16)).toBe("overflow-observe");
  });

  test("拥挤场景会只保留自己、说话者和一个近处提示", () => {
    const policy = resolveRuntimeScenePolicy({
      participantCount: 8,
      quality: resolveSceneQualityProfile({
        width: 1440,
        height: 900,
        devicePixelRatio: 1,
        hardwareConcurrency: 8,
        coarsePointer: false,
      }),
    });
    const users = [
      createUser("self", 640, 395, 2000),
      createUser("nearby", 670, 405, 1800),
      createUser("speaker", 980, 560, 1700),
      createUser("ambient-a", 1020, 560, 1600),
      createUser("ambient-b", 1040, 560, 1500),
    ];

    const priorities = resolveRuntimeOverlayPriorities({
      users,
      selfUserId: "self",
      speakingUserIds: ["speaker"],
      policy,
    });

    expect(priorities.get("self")).toBe("self");
    expect(priorities.get("speaker")).toBe("speaker");
    expect(priorities.get("nearby")).toBe("nearby");
    expect(priorities.has("ambient-a")).toBe(false);
    expect(priorities.has("ambient-b")).toBe(false);
  });

  test("crowded 档会把远端高保真压到 2 个并只保留 1 个 reduced", () => {
    const policy = resolveRuntimeScenePolicy({
      participantCount: 8,
      quality: resolveSceneQualityProfile({
        width: 1440,
        height: 900,
        devicePixelRatio: 1,
        hardwareConcurrency: 8,
        coarsePointer: false,
      }),
    });
    const users = [
      createUser("self", 640, 395, 2000),
      createUser("speaker", 980, 560, 2200),
      createUser("near-1", 670, 405, 2100),
      createUser("near-2", 690, 415, 2050),
      createUser("mid-1", 760, 460, 1800),
      createUser("mid-2", 820, 500, 1700),
      createUser("far-1", 1050, 590, 1600),
      createUser("far-2", 1080, 600, 1500),
    ];

    const fidelity = resolveRuntimeActorFidelity({
      users,
      selfUserId: "self",
      speakingUserIds: ["speaker"],
      policy,
    });

    expect(fidelity.get("self")).toBe("full");
    expect(fidelity.get("speaker")).toBe("full");
    expect(Array.from(fidelity.values()).filter((value) => value === "full")).toHaveLength(3);
    expect(Array.from(fidelity.values()).filter((value) => value === "reduced")).toHaveLength(1);
    expect(Array.from(fidelity.values()).filter((value) => value === "proxy").length).toBeGreaterThan(0);
  });

  test("overflow-observe 档只保留 1 个远端 full 和 1 个 reduced", () => {
    const policy = resolveRuntimeScenePolicy({
      participantCount: 12,
      quality: resolveSceneQualityProfile({
        width: 1440,
        height: 900,
        devicePixelRatio: 1,
        hardwareConcurrency: 8,
        coarsePointer: false,
      }),
    });
    const users = [
      createUser("self", 640, 395, 4000),
      ...Array.from({ length: 8 }, (_, index) =>
        createUser(`user-${index + 1}`, 700 + index * 20, 405 + index * 8, 3000 - index * 100),
      ),
    ];

    const fidelity = resolveRuntimeActorFidelity({
      users,
      selfUserId: "self",
      speakingUserIds: [],
      policy,
    });

    expect(Array.from(fidelity.values()).filter((value) => value === "full")).toHaveLength(2);
    expect(Array.from(fidelity.values()).filter((value) => value === "reduced")).toHaveLength(1);
    expect(Array.from(fidelity.values()).filter((value) => value === "proxy").length).toBeGreaterThan(0);
  });

  test("多人场景会进一步压低动态分辨率上下界", () => {
    const crowdedPolicy = resolveRuntimeScenePolicy({
      participantCount: 8,
      quality: resolveSceneQualityProfile({
        width: 1440,
        height: 900,
        devicePixelRatio: 1.5,
        hardwareConcurrency: 8,
        coarsePointer: false,
      }),
    });
    const overflowPolicy = resolveRuntimeScenePolicy({
      participantCount: 16,
      quality: resolveSceneQualityProfile({
        width: 1728,
        height: 1117,
        devicePixelRatio: 2,
        hardwareConcurrency: 12,
        coarsePointer: false,
      }),
    });

    expect(crowdedPolicy.dynamicResolutionMaxDpr).toBeLessThanOrEqual(0.85);
    expect(crowdedPolicy.dynamicResolutionMinDpr).toBeLessThanOrEqual(0.7);
    expect(overflowPolicy.dynamicResolutionMaxDpr).toBeLessThanOrEqual(0.82);
    expect(overflowPolicy.dynamicResolutionMinDpr).toBeLessThanOrEqual(0.65);
  });
});
