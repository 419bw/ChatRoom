import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const distDir = path.resolve("C:/Users/HP/Desktop/WebGame/Chat/apps/web/dist");
const assetsDir = path.join(distDir, "assets");
const avatarModelPath = path.join(distDir, "models", "avatar-formal.glb");
const desktopRoomModelPath = path.join(
  distDir,
  "models",
  "warm-lounge-room.desktop.glb",
);
const mobileRoomModelPath = path.join(
  distDir,
  "models",
  "warm-lounge-room.mobile.glb",
);
const environmentMapPath = path.join(
  distDir,
  "environments",
  "warm-lounge-sunset.svg",
);

const kb = (bytes) => Number((bytes / 1024).toFixed(2));

const getGzipSize = async (filePath) => {
  const content = await readFile(filePath);
  return gzipSync(content).byteLength;
};

const failIfOverBudget = (label, actual, budget) => {
  if (actual <= budget) {
    return;
  }

  throw new Error(`${label} 超出预算: ${kb(actual)} KB > ${kb(budget)} KB`);
};

const main = async () => {
  const assetNames = await readdir(assetsDir);
  const jsFiles = assetNames.filter((name) => name.endsWith(".js"));

  const gzipEntries = await Promise.all(
    jsFiles.map(async (name) => ({
      name,
      gzip: await getGzipSize(path.join(assetsDir, name)),
    })),
  );

  const shellJs = gzipEntries.filter((entry) => !entry.name.startsWith("scene3d-"));
  const scene3dJs = gzipEntries.filter((entry) => entry.name.startsWith("scene3d-"));
  if (scene3dJs.length === 0) {
    throw new Error("未找到 scene3d 分包，请检查懒加载与 manualChunks 配置");
  }

  const shellBudget = 120 * 1024;
  const scene3dBudget = 820 * 1024;
  const avatarBudget = 180 * 1024;
  const desktopRoomBudget = 420 * 1024;
  const mobileRoomBudget = 260 * 1024;
  const environmentBudget = 40 * 1024;

  const shellTotal = shellJs.reduce((sum, entry) => sum + entry.gzip, 0);
  const scene3dTotal = scene3dJs.reduce((sum, entry) => sum + entry.gzip, 0);
  const avatarSize = (await stat(avatarModelPath)).size;
  const desktopRoomSize = (await stat(desktopRoomModelPath)).size;
  const mobileRoomSize = (await stat(mobileRoomModelPath)).size;
  const environmentSize = (await stat(environmentMapPath)).size;

  failIfOverBudget("首屏 JS gzip 总量", shellTotal, shellBudget);
  failIfOverBudget("3D 运行时 JS gzip 总量", scene3dTotal, scene3dBudget);
  failIfOverBudget("正式角色 GLB", avatarSize, avatarBudget);
  failIfOverBudget("桌面房间 GLB", desktopRoomSize, desktopRoomBudget);
  failIfOverBudget("移动房间 GLB", mobileRoomSize, mobileRoomBudget);
  failIfOverBudget("环境贴图", environmentSize, environmentBudget);

  console.log("Bundle budget check");
  console.log(`- shell gzip: ${kb(shellTotal)} KB`);
  console.log(`- scene3d gzip: ${kb(scene3dTotal)} KB`);
  console.log(`- avatar glb: ${kb(avatarSize)} KB`);
  console.log(`- desktop room glb: ${kb(desktopRoomSize)} KB`);
  console.log(`- mobile room glb: ${kb(mobileRoomSize)} KB`);
  console.log(`- environment map: ${kb(environmentSize)} KB`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
