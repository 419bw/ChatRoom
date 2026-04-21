import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import {
  BufferGeometry,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
  SphereGeometry,
  type Object3D,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

type RoomBuildTier = "desktop" | "mobile";

type Placement = {
  position: [number, number, number];
  rotation?: [number, number, number];
};

type MaterialPalette = {
  wall: MeshStandardMaterial;
  ceiling: MeshStandardMaterial;
  trim: MeshStandardMaterial;
  floor: MeshStandardMaterial;
  windowFrame: MeshStandardMaterial;
  glass: MeshStandardMaterial;
  curtain: MeshStandardMaterial;
  sofa: MeshStandardMaterial;
  pillowLight: MeshStandardMaterial;
  pillowSage: MeshStandardMaterial;
  pillowWarm: MeshStandardMaterial;
  rug: MeshStandardMaterial;
  woodLight: MeshStandardMaterial;
  woodDark: MeshStandardMaterial;
  metalWarm: MeshStandardMaterial;
  plantLeaf: MeshStandardMaterial;
  plantPot: MeshStandardMaterial;
  artCanvas: MeshStandardMaterial;
  artAccent: MeshStandardMaterial;
  artFrame: MeshStandardMaterial;
  lampShade: MeshStandardMaterial;
  lampBulb: MeshStandardMaterial;
  bookCream: MeshStandardMaterial;
  bookRose: MeshStandardMaterial;
  bookSage: MeshStandardMaterial;
  sunPanel: MeshStandardMaterial;
};

const sourceDir = path.resolve("C:/Users/HP/Desktop/WebGame/Chat/apps/web/assets/source");

const sourceAssetPaths = {
  roomDesktop: path.join(sourceDir, "warm-lounge-room.desktop.source.glb"),
  roomMobile: path.join(sourceDir, "warm-lounge-room.mobile.source.glb"),
  roomLegacy: path.join(sourceDir, "warm-lounge-room.source.glb"),
};

const NON_MERGED_NODE_NAMES = new Set([
  "WindowFrame",
  "WindowSill",
  "CurtainRod",
  "CeilingTrimBack",
  "SunPanel",
  "Rug",
  "LampShade",
  "LampBulb",
  "WallArt",
  "WindowGlass",
  "CoffeeTable",
]);

class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;

  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }

  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      const base64 = Buffer.from(buffer).toString("base64");
      this.result = `data:${blob.type || "application/octet-stream"};base64,${base64}`;
      this.onloadend?.();
    });
  }
}

const ensureNodeFileReader = () => {
  if (typeof globalThis.FileReader === "undefined") {
    Object.assign(globalThis, {
      FileReader: NodeFileReader,
    });
  }
};

const setPlacement = (object: Object3D, placement: Placement) => {
  object.position.set(...placement.position);
  if (placement.rotation) {
    object.rotation.set(...placement.rotation);
  }
  return object;
};

const createMesh = (
  name: string,
  geometry: Mesh["geometry"],
  material: MeshStandardMaterial,
  placement: Placement,
) => {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  return setPlacement(mesh, placement);
};

const createRoundedBox = (input: {
  name: string;
  size: [number, number, number];
  material: MeshStandardMaterial;
  placement: Placement;
  radius: number;
  smoothness: number;
}) =>
  createMesh(
    input.name,
    new RoundedBoxGeometry(
      input.size[0],
      input.size[1],
      input.size[2],
      input.smoothness,
      input.radius,
    ),
    input.material,
    input.placement,
  );

const createBox = (input: {
  name: string;
  size: [number, number, number];
  material: MeshStandardMaterial;
  placement: Placement;
}) =>
  createMesh(
    input.name,
    new BoxGeometry(input.size[0], input.size[1], input.size[2]),
    input.material,
    input.placement,
  );

const createCylinder = (input: {
  name: string;
  radiusTop: number;
  radiusBottom: number;
  height: number;
  radialSegments: number;
  material: MeshStandardMaterial;
  placement: Placement;
}) =>
  createMesh(
    input.name,
    new CylinderGeometry(
      input.radiusTop,
      input.radiusBottom,
      input.height,
      input.radialSegments,
      1,
    ),
    input.material,
    input.placement,
  );

const createSphere = (input: {
  name: string;
  radius: number;
  widthSegments: number;
  heightSegments: number;
  material: MeshStandardMaterial;
  placement: Placement;
}) =>
  createMesh(
    input.name,
    new SphereGeometry(
      input.radius,
      input.widthSegments,
      input.heightSegments,
    ),
    input.material,
    input.placement,
  );

const createPalette = (): MaterialPalette => ({
  wall: new MeshStandardMaterial({
    color: new Color("#dacdbf"),
    roughness: 0.98,
    metalness: 0.02,
  }),
  ceiling: new MeshStandardMaterial({
    color: new Color("#f0e5d7"),
    roughness: 0.98,
    metalness: 0.02,
  }),
  trim: new MeshStandardMaterial({
    color: new Color("#bca48f"),
    roughness: 0.96,
    metalness: 0.02,
  }),
  floor: new MeshStandardMaterial({
    color: new Color("#7f624c"),
    roughness: 0.78,
    metalness: 0.06,
  }),
  windowFrame: new MeshStandardMaterial({
    color: new Color("#f1e7da"),
    roughness: 0.84,
    metalness: 0.04,
  }),
  glass: new MeshStandardMaterial({
    color: new Color("#f5e7d4"),
    roughness: 0.1,
    metalness: 0.04,
    transparent: true,
    opacity: 0.42,
  }),
  curtain: new MeshStandardMaterial({
    color: new Color("#e6d6c2"),
    roughness: 0.96,
    metalness: 0.02,
  }),
  sofa: new MeshStandardMaterial({
    color: new Color("#ccb29a"),
    roughness: 0.94,
    metalness: 0.03,
  }),
  pillowLight: new MeshStandardMaterial({
    color: new Color("#efe4d7"),
    roughness: 0.96,
    metalness: 0.02,
  }),
  pillowSage: new MeshStandardMaterial({
    color: new Color("#9eab90"),
    roughness: 0.94,
    metalness: 0.02,
  }),
  pillowWarm: new MeshStandardMaterial({
    color: new Color("#d7b08f"),
    roughness: 0.94,
    metalness: 0.02,
  }),
  rug: new MeshStandardMaterial({
    color: new Color("#c8b3a1"),
    roughness: 0.99,
    metalness: 0.01,
  }),
  woodLight: new MeshStandardMaterial({
    color: new Color("#b99372"),
    roughness: 0.72,
    metalness: 0.05,
  }),
  woodDark: new MeshStandardMaterial({
    color: new Color("#735341"),
    roughness: 0.72,
    metalness: 0.06,
  }),
  metalWarm: new MeshStandardMaterial({
    color: new Color("#b28a62"),
    roughness: 0.42,
    metalness: 0.58,
  }),
  plantLeaf: new MeshStandardMaterial({
    color: new Color("#87977b"),
    roughness: 0.92,
    metalness: 0.02,
  }),
  plantPot: new MeshStandardMaterial({
    color: new Color("#a98262"),
    roughness: 0.86,
    metalness: 0.04,
  }),
  artCanvas: new MeshStandardMaterial({
    color: new Color("#ead7c3"),
    roughness: 0.95,
    metalness: 0.02,
  }),
  artAccent: new MeshStandardMaterial({
    color: new Color("#d6a476"),
    roughness: 0.82,
    metalness: 0.04,
  }),
  artFrame: new MeshStandardMaterial({
    color: new Color("#8b674f"),
    roughness: 0.74,
    metalness: 0.08,
  }),
  lampShade: new MeshStandardMaterial({
    color: new Color("#f0d8bf"),
    roughness: 0.74,
    metalness: 0.04,
  }),
  lampBulb: new MeshStandardMaterial({
    color: new Color("#ffd8a9"),
    emissive: new Color("#f6c28c"),
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.05,
  }),
  bookCream: new MeshStandardMaterial({
    color: new Color("#e7d5c0"),
    roughness: 0.9,
    metalness: 0.03,
  }),
  bookRose: new MeshStandardMaterial({
    color: new Color("#cb9d97"),
    roughness: 0.9,
    metalness: 0.03,
  }),
  bookSage: new MeshStandardMaterial({
    color: new Color("#a4b09a"),
    roughness: 0.9,
    metalness: 0.03,
  }),
  sunPanel: new MeshStandardMaterial({
    color: new Color("#f4be82"),
    emissive: new Color("#f4ad6a"),
    emissiveIntensity: 0.52,
    roughness: 0.48,
    metalness: 0.02,
  }),
});

const resolveMergeClusterName = (name: string) => {
  if (NON_MERGED_NODE_NAMES.has(name)) {
    return null;
  }

  if (name.includes("Wall")) {
    return "WallCluster";
  }

  if (name.includes("Ceiling")) {
    return "CeilingCluster";
  }

  if (name.includes("Trim")) {
    return "TrimCluster";
  }

  if (name.includes("WindowFrame")) {
    return "WindowFrameCluster";
  }

  if (name.includes("Curtain")) {
    return "CurtainCluster";
  }

  if (name.includes("Sofa")) {
    return "SofaCluster";
  }

  if (name.includes("Pillow")) {
    return "PillowCluster";
  }

  if (name.includes("CoffeeTable")) {
    return "CoffeeTableCluster";
  }

  if (name.includes("SideTable")) {
    return "SideTableCluster";
  }

  if (name.includes("Lamp")) {
    return "LampCluster";
  }

  if (name.includes("Shelf")) {
    return "ShelfCluster";
  }

  if (name.includes("Book")) {
    return "BookCluster";
  }

  if (name.includes("PlantPot")) {
    return "PlantPotCluster";
  }

  if (name.includes("Plant")) {
    return "PlantCluster";
  }

  if (name.includes("WallArt")) {
    return "WallArtCluster";
  }

  if (name.includes("Sun")) {
    return "SunCluster";
  }

  return null;
};

const mergeStaticSceneMeshes = (root: Group) => {
  const mergeBuckets = new Map<
    string,
    {
      material: MeshStandardMaterial;
      meshes: Mesh[];
      geometries: BufferGeometry[];
    }
  >();

  root.updateMatrixWorld(true);

  for (const child of [...root.children]) {
    if (!(child instanceof Mesh)) {
      continue;
    }

    const material = Array.isArray(child.material)
      ? child.material[0]
      : child.material;
    if (!(material instanceof MeshStandardMaterial)) {
      continue;
    }

    const clusterName = resolveMergeClusterName(child.name);
    if (!clusterName) {
      continue;
    }

    const bucketKey = `${clusterName}:${material.uuid}`;
    const geometry = child.geometry.index
      ? child.geometry.clone().toNonIndexed()
      : child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);

    const bucket = mergeBuckets.get(bucketKey) ?? {
      material,
      meshes: [],
      geometries: [],
    };
    bucket.meshes.push(child);
    bucket.geometries.push(geometry);
    mergeBuckets.set(bucketKey, bucket);
  }

  for (const [bucketKey, bucket] of mergeBuckets.entries()) {
    if (bucket.geometries.length < 2) {
      continue;
    }

    const mergedGeometry = mergeGeometries(bucket.geometries, false);
    if (!mergedGeometry) {
      continue;
    }

    const [clusterName] = bucketKey.split(":");
    const mesh = new Mesh(mergedGeometry, bucket.material);
    mesh.name = clusterName;
    for (const sourceMesh of bucket.meshes) {
      root.remove(sourceMesh);
    }
    root.add(mesh);
  }
};

const addArchitecture = (
  root: Group,
  palette: MaterialPalette,
  smoothness: number,
) => {
  root.add(
    createBox({
      name: "Floor",
      size: [12.2, 0.14, 9.5],
      material: palette.floor,
      placement: {
        position: [0, -0.07, -1.35],
      },
    }),
    createBox({
      name: "Ceiling",
      size: [11.8, 0.12, 7.9],
      material: palette.ceiling,
      placement: {
        position: [0, 3.38, -2.2],
      },
    }),
    createBox({
      name: "WallBackLeft",
      size: [6.7, 3.26, 0.18],
      material: palette.wall,
      placement: {
        position: [-2.55, 1.63, -5.18],
      },
    }),
    createBox({
      name: "WallBackRight",
      size: [1.55, 3.26, 0.18],
      material: palette.wall,
      placement: {
        position: [5.1, 1.63, -5.18],
      },
    }),
    createBox({
      name: "WallBackLower",
      size: [3.3, 1.08, 0.18],
      material: palette.wall,
      placement: {
        position: [2.55, 0.54, -5.18],
      },
    }),
    createBox({
      name: "WallBackTop",
      size: [3.3, 0.72, 0.18],
      material: palette.wall,
      placement: {
        position: [2.55, 3.0, -5.18],
      },
    }),
    createBox({
      name: "WallLeft",
      size: [0.18, 3.26, 7.1],
      material: palette.wall,
      placement: {
        position: [-5.96, 1.63, -2.0],
      },
    }),
    createBox({
      name: "WallRight",
      size: [0.18, 3.26, 5.5],
      material: palette.wall,
      placement: {
        position: [5.96, 1.63, -2.8],
      },
    }),
    createBox({
      name: "CeilingTrimBack",
      size: [11.2, 0.14, 0.16],
      material: palette.trim,
      placement: {
        position: [0, 3.1, -5.02],
      },
    }),
    createBox({
      name: "TrimBackBase",
      size: [10.8, 0.18, 0.14],
      material: palette.trim,
      placement: {
        position: [-0.25, 0.09, -5.03],
      },
    }),
    createBox({
      name: "TrimLeftBase",
      size: [0.14, 0.18, 6.6],
      material: palette.trim,
      placement: {
        position: [-5.84, 0.09, -2.25],
      },
    }),
    createBox({
      name: "TrimRightBase",
      size: [0.14, 0.18, 4.9],
      material: palette.trim,
      placement: {
        position: [5.84, 0.09, -2.95],
      },
    }),
    createBox({
      name: "TrimPanelBackOuter",
      size: [3.25, 1.85, 0.05],
      material: palette.trim,
      placement: {
        position: [-2.2, 1.68, -5.07],
      },
    }),
    createBox({
      name: "TrimPanelBackInner",
      size: [2.93, 1.55, 0.06],
      material: palette.wall,
      placement: {
        position: [-2.2, 1.68, -5.05],
      },
    }),
    createBox({
      name: "TrimPanelLeftOuter",
      size: [0.05, 1.65, 2.2],
      material: palette.trim,
      placement: {
        position: [-5.87, 1.52, -2.95],
      },
    }),
    createBox({
      name: "TrimPanelLeftInner",
      size: [0.06, 1.35, 1.86],
      material: palette.wall,
      placement: {
        position: [-5.85, 1.52, -2.95],
      },
    }),
  );

  root.add(
    createBox({
      name: "WindowFrame",
      size: [3.56, 0.12, 0.14],
      material: palette.windowFrame,
      placement: {
        position: [2.55, 2.76, -5.02],
      },
    }),
    createBox({
      name: "WindowFrameBottom",
      size: [3.56, 0.12, 0.14],
      material: palette.windowFrame,
      placement: {
        position: [2.55, 1.08, -5.02],
      },
    }),
    createBox({
      name: "WindowFrameLeft",
      size: [0.12, 1.82, 0.14],
      material: palette.windowFrame,
      placement: {
        position: [0.84, 1.91, -5.02],
      },
    }),
    createBox({
      name: "WindowFrameRight",
      size: [0.12, 1.82, 0.14],
      material: palette.windowFrame,
      placement: {
        position: [4.26, 1.91, -5.02],
      },
    }),
    createBox({
      name: "WindowFrameMullion",
      size: [0.08, 1.74, 0.12],
      material: palette.windowFrame,
      placement: {
        position: [2.55, 1.9, -5.01],
      },
    }),
    createBox({
      name: "WindowFrameRail",
      size: [3.34, 0.08, 0.12],
      material: palette.windowFrame,
      placement: {
        position: [2.55, 1.9, -5.01],
      },
    }),
    createBox({
      name: "WindowGlass",
      size: [3.16, 1.72, 0.03],
      material: palette.glass,
      placement: {
        position: [2.55, 1.91, -5.08],
      },
    }),
    createBox({
      name: "WindowSill",
      size: [3.58, 0.12, 0.42],
      material: palette.windowFrame,
      placement: {
        position: [2.55, 0.98, -4.95],
      },
    }),
    createCylinder({
      name: "CurtainRod",
      radiusTop: 0.035,
      radiusBottom: 0.035,
      height: 4.08,
      radialSegments: smoothness > 3 ? 18 : 12,
      material: palette.metalWarm,
      placement: {
        position: [2.55, 2.92, -4.92],
        rotation: [0, 0, Math.PI / 2],
      },
    }),
    createRoundedBox({
      name: "CurtainLeft",
      size: [0.82, 2.1, 0.11],
      material: palette.curtain,
      placement: {
        position: [1.18, 1.82, -4.92],
        rotation: [0, 0.08, 0],
      },
      radius: 0.06,
      smoothness,
    }),
    createRoundedBox({
      name: "CurtainRight",
      size: [0.92, 2.12, 0.11],
      material: palette.curtain,
      placement: {
        position: [3.98, 1.82, -4.92],
        rotation: [0, -0.08, 0],
      },
      radius: 0.06,
      smoothness,
    }),
    createBox({
      name: "SunPanel",
      size: [3.7, 2.16, 0.03],
      material: palette.sunPanel,
      placement: {
        position: [2.55, 1.95, -5.34],
      },
    }),
  );
};

const addSofaArea = (
  root: Group,
  palette: MaterialPalette,
  smoothness: number,
) => {
  root.add(
    createRoundedBox({
      name: "Rug",
      size: [5.4, 0.05, 3.7],
      material: palette.rug,
      placement: {
        position: [-0.15, 0.03, -1.18],
        rotation: [0, -0.03, 0],
      },
      radius: 0.14,
      smoothness,
    }),
    createRoundedBox({
      name: "SofaBase",
      size: [3.2, 0.54, 1.08],
      material: palette.sofa,
      placement: {
        position: [-1.88, 0.35, -2.02],
      },
      radius: 0.12,
      smoothness,
    }),
    createRoundedBox({
      name: "SofaBack",
      size: [3.14, 0.92, 0.26],
      material: palette.sofa,
      placement: {
        position: [-1.88, 0.92, -2.38],
      },
      radius: 0.1,
      smoothness,
    }),
    createRoundedBox({
      name: "SofaArmLeft",
      size: [0.28, 0.72, 1.04],
      material: palette.sofa,
      placement: {
        position: [-3.34, 0.67, -2.02],
      },
      radius: 0.1,
      smoothness,
    }),
    createRoundedBox({
      name: "SofaArmRight",
      size: [0.28, 0.72, 1.04],
      material: palette.sofa,
      placement: {
        position: [-0.42, 0.67, -2.02],
      },
      radius: 0.1,
      smoothness,
    }),
    createRoundedBox({
      name: "SofaChaise",
      size: [1.58, 0.44, 1.46],
      material: palette.sofa,
      placement: {
        position: [-3.05, 0.29, -1.2],
      },
      radius: 0.1,
      smoothness,
    }),
    createRoundedBox({
      name: "SofaBackChaise",
      size: [0.28, 0.68, 1.46],
      material: palette.sofa,
      placement: {
        position: [-3.72, 0.63, -1.2],
      },
      radius: 0.1,
      smoothness,
    }),
    createRoundedBox({
      name: "PillowLightLeft",
      size: [0.56, 0.28, 0.52],
      material: palette.pillowLight,
      placement: {
        position: [-2.62, 0.79, -1.88],
        rotation: [0.12, 0.24, 0],
      },
      radius: 0.08,
      smoothness,
    }),
    createRoundedBox({
      name: "PillowSageCenter",
      size: [0.52, 0.28, 0.46],
      material: palette.pillowSage,
      placement: {
        position: [-1.72, 0.82, -1.96],
        rotation: [0.08, -0.18, 0],
      },
      radius: 0.08,
      smoothness,
    }),
    createRoundedBox({
      name: "PillowWarmRight",
      size: [0.48, 0.28, 0.42],
      material: palette.pillowWarm,
      placement: {
        position: [-0.95, 0.8, -1.92],
        rotation: [0.1, -0.14, 0],
      },
      radius: 0.08,
      smoothness,
    }),
  );
};

const addTablesAndLamp = (
  root: Group,
  palette: MaterialPalette,
  smoothness: number,
) => {
  root.add(
    createRoundedBox({
      name: "CoffeeTable",
      size: [2.18, 0.1, 1.02],
      material: palette.woodLight,
      placement: {
        position: [0.12, 0.47, -0.96],
      },
      radius: 0.08,
      smoothness,
    }),
    createRoundedBox({
      name: "CoffeeTableShelf",
      size: [1.78, 0.08, 0.74],
      material: palette.woodDark,
      placement: {
        position: [0.12, 0.24, -0.96],
      },
      radius: 0.06,
      smoothness,
    }),
    createBox({
      name: "CoffeeTableLegA",
      size: [0.16, 0.4, 0.16],
      material: palette.woodDark,
      placement: {
        position: [-0.74, 0.24, -1.3],
      },
    }),
    createBox({
      name: "CoffeeTableLegB",
      size: [0.16, 0.4, 0.16],
      material: palette.woodDark,
      placement: {
        position: [0.98, 0.24, -1.3],
      },
    }),
    createBox({
      name: "CoffeeTableLegC",
      size: [0.16, 0.4, 0.16],
      material: palette.woodDark,
      placement: {
        position: [-0.74, 0.24, -0.62],
      },
    }),
    createBox({
      name: "CoffeeTableLegD",
      size: [0.16, 0.4, 0.16],
      material: palette.woodDark,
      placement: {
        position: [0.98, 0.24, -0.62],
      },
    }),
    createRoundedBox({
      name: "SideTable",
      size: [0.74, 0.08, 0.74],
      material: palette.woodLight,
      placement: {
        position: [2.02, 0.58, -1.78],
      },
      radius: 0.07,
      smoothness,
    }),
    createCylinder({
      name: "SideTableLeg",
      radiusTop: 0.08,
      radiusBottom: 0.11,
      height: 0.94,
      radialSegments: smoothness > 3 ? 18 : 12,
      material: palette.woodDark,
      placement: {
        position: [2.02, 0.12, -1.78],
      },
    }),
    createRoundedBox({
      name: "SofaWindowBench",
      size: [1.62, 0.42, 0.72],
      material: palette.sofa,
      placement: {
        position: [2.84, 0.28, -4.35],
      },
      radius: 0.09,
      smoothness,
    }),
    createRoundedBox({
      name: "SofaWindowBenchBack",
      size: [1.62, 0.42, 0.18],
      material: palette.sofa,
      placement: {
        position: [2.84, 0.64, -4.62],
      },
      radius: 0.07,
      smoothness,
    }),
    createRoundedBox({
      name: "PillowWindowBench",
      size: [0.46, 0.24, 0.38],
      material: palette.pillowLight,
      placement: {
        position: [3.18, 0.6, -4.27],
        rotation: [0.08, -0.18, 0],
      },
      radius: 0.06,
      smoothness,
    }),
    createCylinder({
      name: "LampStand",
      radiusTop: 0.035,
      radiusBottom: 0.05,
      height: 1.72,
      radialSegments: smoothness > 3 ? 18 : 12,
      material: palette.metalWarm,
      placement: {
        position: [3.7, 1.03, -2.34],
      },
    }),
    createCylinder({
      name: "LampBase",
      radiusTop: 0.24,
      radiusBottom: 0.28,
      height: 0.06,
      radialSegments: smoothness > 3 ? 18 : 12,
      material: palette.metalWarm,
      placement: {
        position: [3.7, 0.03, -2.34],
      },
    }),
    createCylinder({
      name: "LampShade",
      radiusTop: 0.24,
      radiusBottom: 0.4,
      height: 0.52,
      radialSegments: smoothness > 3 ? 20 : 14,
      material: palette.lampShade,
      placement: {
        position: [3.7, 2.02, -2.34],
      },
    }),
    createSphere({
      name: "LampBulb",
      radius: 0.11,
      widthSegments: smoothness > 3 ? 16 : 12,
      heightSegments: smoothness > 3 ? 12 : 8,
      material: palette.lampBulb,
      placement: {
        position: [3.7, 1.86, -2.34],
      },
    }),
  );
};

const addShelfAndBooks = (
  root: Group,
  palette: MaterialPalette,
  tier: RoomBuildTier,
  smoothness: number,
) => {
  root.add(
    createBox({
      name: "ShelfSideLeft",
      size: [0.12, 2.04, 1.04],
      material: palette.woodDark,
      placement: {
        position: [-4.72, 1.02, -2.38],
      },
    }),
    createBox({
      name: "ShelfSideRight",
      size: [0.12, 2.04, 1.04],
      material: palette.woodDark,
      placement: {
        position: [-3.82, 1.02, -2.38],
      },
    }),
    createBox({
      name: "ShelfTop",
      size: [1.02, 0.12, 1.04],
      material: palette.woodDark,
      placement: {
        position: [-4.27, 2.02, -2.38],
      },
    }),
    createBox({
      name: "ShelfBoardTop",
      size: [0.9, 0.09, 0.96],
      material: palette.woodLight,
      placement: {
        position: [-4.27, 1.52, -2.38],
      },
    }),
    createBox({
      name: "ShelfBoardBottom",
      size: [0.9, 0.09, 0.96],
      material: palette.woodLight,
      placement: {
        position: [-4.27, 0.96, -2.38],
      },
    }),
  );

  const books = tier === "desktop"
    ? [
        { name: "BookCreamA", x: -4.55, y: 1.73, z: -2.53, h: 0.32, material: palette.bookCream },
        { name: "BookRoseA", x: -4.38, y: 1.72, z: -2.46, h: 0.34, material: palette.bookRose },
        { name: "BookSageA", x: -4.18, y: 1.7, z: -2.38, h: 0.38, material: palette.bookSage },
        { name: "BookCreamB", x: -4.0, y: 1.73, z: -2.28, h: 0.31, material: palette.bookCream },
        { name: "BookRoseB", x: -4.5, y: 1.16, z: -2.26, h: 0.28, material: palette.bookRose },
        { name: "BookSageB", x: -4.28, y: 1.16, z: -2.48, h: 0.29, material: palette.bookSage },
      ]
    : [
        { name: "BookCreamA", x: -4.45, y: 1.73, z: -2.48, h: 0.3, material: palette.bookCream },
        { name: "BookSageA", x: -4.18, y: 1.7, z: -2.34, h: 0.36, material: palette.bookSage },
        { name: "BookRoseB", x: -4.42, y: 1.16, z: -2.34, h: 0.28, material: palette.bookRose },
      ];

  for (const book of books) {
    root.add(
      createRoundedBox({
        name: book.name,
        size: [0.13, book.h, 0.22],
        material: book.material,
        placement: {
          position: [book.x, book.y, book.z],
          rotation: [0, 0.08, 0],
        },
        radius: 0.02,
        smoothness: Math.max(2, smoothness - 1),
      }),
    );
  }
};

const addWallArt = (
  root: Group,
  palette: MaterialPalette,
  smoothness: number,
) => {
  root.add(
    createBox({
      name: "WallArtFrame",
      size: [1.48, 0.96, 0.07],
      material: palette.artFrame,
      placement: {
        position: [-1.18, 1.84, -5.04],
      },
    }),
    createBox({
      name: "WallArt",
      size: [1.26, 0.76, 0.05],
      material: palette.artCanvas,
      placement: {
        position: [-1.18, 1.84, -5.0],
      },
    }),
    createRoundedBox({
      name: "WallArtSun",
      size: [0.34, 0.34, 0.05],
      material: palette.artAccent,
      placement: {
        position: [-1.02, 1.98, -4.96],
      },
      radius: 0.17,
      smoothness,
    }),
    createRoundedBox({
      name: "WallArtAccentPanel",
      size: [0.58, 0.16, 0.04],
      material: palette.pillowWarm,
      placement: {
        position: [-1.28, 1.62, -4.96],
        rotation: [0, 0, -0.18],
      },
      radius: 0.04,
      smoothness,
    }),
  );
};

const addPlants = (
  root: Group,
  palette: MaterialPalette,
  tier: RoomBuildTier,
  smoothness: number,
) => {
  root.add(
    createCylinder({
      name: "PlantPotLeft",
      radiusTop: 0.26,
      radiusBottom: 0.3,
      height: 0.46,
      radialSegments: smoothness > 3 ? 18 : 12,
      material: palette.plantPot,
      placement: {
        position: [-4.78, 0.23, -3.18],
      },
    }),
    createSphere({
      name: "PlantLeafLeftMain",
      radius: 0.36,
      widthSegments: smoothness > 3 ? 16 : 10,
      heightSegments: smoothness > 3 ? 12 : 8,
      material: palette.plantLeaf,
      placement: {
        position: [-4.88, 0.94, -3.12],
      },
    }),
    createSphere({
      name: "PlantLeafLeftAccent",
      radius: 0.28,
      widthSegments: smoothness > 3 ? 14 : 10,
      heightSegments: smoothness > 3 ? 10 : 8,
      material: palette.plantLeaf,
      placement: {
        position: [-4.58, 1.1, -3.3],
      },
    }),
  );

  if (tier === "desktop") {
    root.add(
      createCylinder({
        name: "PlantPotRight",
        radiusTop: 0.24,
        radiusBottom: 0.28,
        height: 0.4,
        radialSegments: smoothness > 3 ? 18 : 12,
        material: palette.plantPot,
        placement: {
          position: [4.55, 0.2, -4.18],
        },
      }),
      createSphere({
        name: "PlantLeafRightMain",
        radius: 0.32,
        widthSegments: smoothness > 3 ? 16 : 10,
        heightSegments: smoothness > 3 ? 12 : 8,
        material: palette.plantLeaf,
        placement: {
          position: [4.55, 0.86, -4.14],
        },
      }),
      createSphere({
        name: "PlantLeafRightAccent",
        radius: 0.24,
        widthSegments: smoothness > 3 ? 14 : 10,
        heightSegments: smoothness > 3 ? 10 : 8,
        material: palette.plantLeaf,
        placement: {
          position: [4.28, 1.02, -4.3],
        },
      }),
    );
  }
};

const addDesktopOnlyAccents = (
  root: Group,
  palette: MaterialPalette,
  smoothness: number,
) => {
  root.add(
    createRoundedBox({
      name: "SunWash",
      size: [1.46, 0.04, 1.12],
      material: palette.sunPanel,
      placement: {
        position: [2.76, 0.02, -3.35],
        rotation: [0, 0.14, 0],
      },
      radius: 0.04,
      smoothness,
    }),
    createRoundedBox({
      name: "BookStackCoffeeTable",
      size: [0.44, 0.08, 0.32],
      material: palette.bookCream,
      placement: {
        position: [-0.34, 0.57, -0.82],
        rotation: [0, 0.28, 0],
      },
      radius: 0.03,
      smoothness,
    }),
    createRoundedBox({
      name: "TrayCoffeeTable",
      size: [0.56, 0.04, 0.36],
      material: palette.woodDark,
      placement: {
        position: [0.7, 0.55, -1.02],
        rotation: [0, -0.24, 0],
      },
      radius: 0.03,
      smoothness,
    }),
  );
};

const buildWarmLoungeRoomScene = (tier: RoomBuildTier) => {
  const scene = new Scene();
  scene.name = `WarmLoungeRoom-${tier}`;

  const root = new Group();
  root.name = "WarmLoungeRoom";
  scene.add(root);

  const palette = createPalette();
  const smoothness = tier === "desktop" ? 4 : 2;

  addArchitecture(root, palette, smoothness);
  addSofaArea(root, palette, smoothness);
  addTablesAndLamp(root, palette, smoothness);
  addShelfAndBooks(root, palette, tier, smoothness);
  addWallArt(root, palette, smoothness);
  addPlants(root, palette, tier, smoothness);

  if (tier === "desktop") {
    addDesktopOnlyAccents(root, palette, smoothness);
  }

  mergeStaticSceneMeshes(root);

  return scene;
};

const exportSceneToGlbBuffer = async (scene: Scene) => {
  ensureNodeFileReader();
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, {
    binary: true,
    onlyVisible: true,
  });

  if (!(result instanceof ArrayBuffer)) {
    throw new Error("warm lounge source export did not return binary GLB data");
  }

  return Buffer.from(new Uint8Array(result));
};

const writeGlb = async (filePath: string, content: Buffer) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
};

export const buildWarmLoungeRoomSourceAssets = async () => {
  const desktopContent = await exportSceneToGlbBuffer(buildWarmLoungeRoomScene("desktop"));
  const mobileContent = await exportSceneToGlbBuffer(buildWarmLoungeRoomScene("mobile"));

  await writeGlb(sourceAssetPaths.roomDesktop, desktopContent);
  await writeGlb(sourceAssetPaths.roomMobile, mobileContent);
  await writeGlb(sourceAssetPaths.roomLegacy, desktopContent);
};
