import path from "node:path";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { describe, expect, test } from "vitest";
import { MeshoptDecoder } from "meshoptimizer";

const createIo = () =>
  new NodeIO().registerExtensions(KHRONOS_EXTENSIONS).registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
  });

const readAssetDocument = async (relativePath: string) => {
  const assetUrl = new URL(relativePath, import.meta.url);
  await MeshoptDecoder.ready;
  return createIo().read(fileURLToPath(assetUrl));
};

const requiredRoomNodeNames = [
  "WindowFrame",
  "WindowSill",
  "CurtainRod",
  "CeilingTrimBack",
  "SunPanel",
  "Rug",
  "LampShade",
  "WallArt",
] as const;

describe("asset pipeline validation", () => {
  test("桌面与移动房间 shipping GLB 都包含关键暖调客厅节点", async () => {
    const [desktopDocument, mobileDocument] = await Promise.all([
      readAssetDocument("../../public/models/warm-lounge-room.desktop.glb"),
      readAssetDocument("../../public/models/warm-lounge-room.mobile.glb"),
    ]);

    for (const document of [desktopDocument, mobileDocument]) {
      const discoveredNames = new Set(
        document
          .getRoot()
          .listNodes()
          .map((node) => node.getName())
          .filter(Boolean),
      );

      for (const requiredNodeName of requiredRoomNodeNames) {
        expect(discoveredNames.has(requiredNodeName)).toBe(true);
      }

      const materialCount = document.getRoot().listMaterials().length;
      expect(materialCount).toBeGreaterThan(0);
      expect(materialCount).toBeLessThanOrEqual(64);

    }
  });

  test("角色 shipping GLB 保持 Idle/Walk 动画与关键目标节点", async () => {
    const document = await readAssetDocument("../../public/models/avatar-formal.glb");
    const animationNames = document
      .getRoot()
      .listAnimations()
      .map((animation) => animation.getName());
    const walkAnimation = document
      .getRoot()
      .listAnimations()
      .find((animation) => animation.getName() === "Walk");

    expect(animationNames).toContain("Idle");
    expect(animationNames).toContain("Walk");
    expect(
      new Set(
        walkAnimation?.listChannels().map((channel) => channel.getTargetNode()?.getName() ?? ""),
      ),
    ).toEqual(new Set(["Root", "Arm.L", "Arm.R", "Leg.L", "Leg.R"]));
  });

  test("房间与环境资源体积符合预算", async () => {
    const [desktopRoom, mobileRoom, environmentMap] = await Promise.all([
      stat(
        path.resolve(
          "C:/Users/HP/Desktop/WebGame/Chat/apps/web/public/models/warm-lounge-room.desktop.glb",
        ),
      ),
      stat(
        path.resolve(
          "C:/Users/HP/Desktop/WebGame/Chat/apps/web/public/models/warm-lounge-room.mobile.glb",
        ),
      ),
      stat(
        path.resolve(
          "C:/Users/HP/Desktop/WebGame/Chat/apps/web/public/environments/warm-lounge-sunset.svg",
        ),
      ),
    ]);

    expect(desktopRoom.size).toBeLessThanOrEqual(420 * 1024);
    expect(mobileRoom.size).toBeLessThanOrEqual(260 * 1024);
    expect(environmentMap.size).toBeLessThanOrEqual(40 * 1024);
  });
});
