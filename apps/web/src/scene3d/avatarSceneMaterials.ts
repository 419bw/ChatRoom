import { Mesh, MeshStandardMaterial, type Object3D } from "three";

import { avatarColorMap } from "./assetManifest";
import { resetOwnedStandardMaterialBaseColor } from "./ownedStandardMaterials";

type AvatarCosmeticKey = keyof typeof avatarColorMap;
type AvatarPalette = (typeof avatarColorMap)[AvatarCosmeticKey];

const applyAvatarPalette = (
  material: MeshStandardMaterial,
  objectName: string,
  palette: AvatarPalette,
) => {
  material.roughness = 0.74;
  material.metalness = 0.04;
  resetOwnedStandardMaterialBaseColor(material);

  if (objectName.includes("Body") || objectName.includes("Leg")) {
    material.color.set(palette.body);
    return;
  }

  if (objectName.includes("Accent") || objectName.includes("Shoe")) {
    material.color.set(palette.accent);
    return;
  }

  if (objectName.includes("Hair")) {
    material.color.set(palette.hair);
    return;
  }

  if (objectName.includes("Head") || objectName.includes("Arm")) {
    material.color.set(palette.skin);
  }
};

export const syncAvatarSceneMaterials = (input: {
  root: Object3D;
  cosmetic: AvatarCosmeticKey;
  enableShadows: boolean;
}) => {
  const palette = avatarColorMap[input.cosmetic];
  const ownedMaterials = new Set<MeshStandardMaterial>();

  input.root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    object.castShadow = input.enableShadows;
    object.receiveShadow = input.enableShadows;

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of materials) {
      if (!(material instanceof MeshStandardMaterial)) {
        continue;
      }

      applyAvatarPalette(material, object.name, palette);
      ownedMaterials.add(material);
    }
  });

  return Array.from(ownedMaterials);
};
