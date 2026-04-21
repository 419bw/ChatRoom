import path from "node:path";
import { access, mkdir, stat } from "node:fs/promises";

import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  meshopt,
  prune,
  quantize,
  weld,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

import { buildWarmLoungeRoomSourceAssets } from "./build-warm-lounge-room-sources";

const rootDir = path.resolve("C:/Users/HP/Desktop/WebGame/Chat/apps/web");
const sourceDir = path.join(rootDir, "assets", "source");
const outputDir = path.join(rootDir, "public", "models");

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

const requiredWalkNodes = ["Root", "Arm.L", "Arm.R", "Leg.L", "Leg.R"] as const;

const sourceAssets = {
  roomDesktop: path.join(sourceDir, "warm-lounge-room.desktop.source.glb"),
  roomMobile: path.join(sourceDir, "warm-lounge-room.mobile.source.glb"),
  avatar: path.join(sourceDir, "avatar-formal.source.glb"),
};

const shippingAssets = {
  roomDesktop: path.join(outputDir, "warm-lounge-room.desktop.glb"),
  roomMobile: path.join(outputDir, "warm-lounge-room.mobile.glb"),
  avatar: path.join(outputDir, "avatar-formal.glb"),
};

const kb = (bytes: number) => Number((bytes / 1024).toFixed(2));

const createIo = () =>
  new NodeIO().registerExtensions(KHRONOS_EXTENSIONS).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });

const ensureFileExists = async (filePath: string) => {
  await access(filePath);
  return filePath;
};

const validateRoomDocument = async (
  assetPath: string,
  assetLabel: string,
  options: {
    requiredNodeNames: readonly string[];
    maxMaterialCount: number;
    maxTextureBytes: number;
  },
) => {
  const io = createIo();
  await MeshoptDecoder.ready;
  const document = await io.read(assetPath);
  const scene = document.getRoot().listScenes()[0];

  if (!scene) {
    throw new Error(`${assetLabel} 缺少场景根节点`);
  }

  const discoveredNames = new Set(
    document
      .getRoot()
      .listNodes()
      .map((node) => node.getName())
      .filter(Boolean),
  );

  for (const requiredNodeName of options.requiredNodeNames) {
    if (!discoveredNames.has(requiredNodeName)) {
      throw new Error(`${assetLabel} 缺少关键节点: ${requiredNodeName}`);
    }
  }

  const materials = document.getRoot().listMaterials();
  if (materials.length > options.maxMaterialCount) {
    throw new Error(
      `${assetLabel} 材质数量超出预算: ${materials.length} > ${options.maxMaterialCount}`,
    );
  }

  const textureBytes = document
    .getRoot()
    .listTextures()
    .reduce((sum, texture) => sum + (texture.getImage()?.byteLength ?? 0), 0);
  if (textureBytes > options.maxTextureBytes) {
    throw new Error(
      `${assetLabel} 贴图字节超出预算: ${kb(textureBytes)} KB > ${kb(options.maxTextureBytes)} KB`,
    );
  }
};

const validateAnimationDocument = async (
  assetPath: string,
  assetLabel: string,
) => {
  const io = createIo();
  await MeshoptDecoder.ready;
  const document = await io.read(assetPath);
  const animations = document.getRoot().listAnimations();

  if (animations.length === 0) {
    throw new Error(`${assetLabel} 缺少动画片段`);
  }

  const animationNames = animations.map((animation) => animation.getName());
  if (!animationNames.includes("Idle") || !animationNames.includes("Walk")) {
    throw new Error(`${assetLabel} 必须同时包含 Idle 与 Walk 动画`);
  }

  const walkAnimation = animations.find((animation) => animation.getName() === "Walk");
  if (!walkAnimation) {
    throw new Error(`${assetLabel} 缺少 Walk 动画`);
  }

  const targetNodes = new Set(
    walkAnimation
      .listChannels()
      .map((channel) => channel.getTargetNode()?.getName() ?? ""),
  );
  for (const requiredNode of requiredWalkNodes) {
    if (!targetNodes.has(requiredNode)) {
      throw new Error(`${assetLabel} 的 Walk 动画缺少关键目标节点: ${requiredNode}`);
    }
  }
};

const optimizeAsset = async (
  inputPath: string,
  outputPath: string,
  options: {
    kind: "room-desktop" | "room-mobile" | "avatar";
  },
) => {
  const io = createIo();
  const document = await io.read(inputPath);

  await MeshoptEncoder.ready;
  await document.transform(
    dedup(),
    prune(),
    weld(),
    quantize({
      quantizePosition: options.kind === "room-mobile" ? 12 : 14,
      quantizeNormal: options.kind === "room-mobile" ? 9 : 10,
      quantizeTexcoord: 12,
    }),
    meshopt({
      encoder: MeshoptEncoder,
      level: options.kind === "room-mobile" ? "high" : "medium",
    }),
  );

  await mkdir(outputDir, { recursive: true });
  await io.write(outputPath, document);
};

const logBudget = async (assetLabel: string, assetPath: string, budget: number) => {
  const size = (await stat(assetPath)).size;
  if (size > budget) {
    throw new Error(`${assetLabel} 超出预算: ${kb(size)} KB > ${kb(budget)} KB`);
  }

  console.log(`- ${assetLabel}: ${kb(size)} KB`);
};

const main = async () => {
  await buildWarmLoungeRoomSourceAssets();
  await ensureFileExists(sourceAssets.avatar);

  await validateRoomDocument(sourceAssets.roomDesktop, "warm-lounge-room.desktop.source.glb", {
    requiredNodeNames: requiredRoomNodeNames,
    maxMaterialCount: 64,
    maxTextureBytes: 1024 * 1024 * 2,
  });
  await validateRoomDocument(sourceAssets.roomMobile, "warm-lounge-room.mobile.source.glb", {
    requiredNodeNames: requiredRoomNodeNames,
    maxMaterialCount: 64,
    maxTextureBytes: 1024 * 1024,
  });
  await validateAnimationDocument(sourceAssets.avatar, "avatar-formal.source.glb");

  await optimizeAsset(sourceAssets.roomDesktop, shippingAssets.roomDesktop, {
    kind: "room-desktop",
  });
  await optimizeAsset(sourceAssets.roomMobile, shippingAssets.roomMobile, {
    kind: "room-mobile",
  });
  await optimizeAsset(sourceAssets.avatar, shippingAssets.avatar, {
    kind: "avatar",
  });

  await validateRoomDocument(shippingAssets.roomDesktop, "warm-lounge-room.desktop.glb", {
    requiredNodeNames: requiredRoomNodeNames,
    maxMaterialCount: 64,
    maxTextureBytes: 1024 * 1024 * 2,
  });
  await validateRoomDocument(shippingAssets.roomMobile, "warm-lounge-room.mobile.glb", {
    requiredNodeNames: requiredRoomNodeNames,
    maxMaterialCount: 56,
    maxTextureBytes: 1024 * 1024,
  });
  await validateAnimationDocument(shippingAssets.avatar, "avatar-formal.glb");

  console.log("3D 资产已完成正式源校验与出包：");
  await logBudget("桌面房间 GLB", shippingAssets.roomDesktop, 420 * 1024);
  await logBudget("移动房间 GLB", shippingAssets.roomMobile, 260 * 1024);
  await logBudget("角色 GLB", shippingAssets.avatar, 180 * 1024);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
