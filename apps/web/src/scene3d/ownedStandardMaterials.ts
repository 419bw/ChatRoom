import { Mesh, MeshStandardMaterial, type Object3D } from "three";

const OWNED_STANDARD_MATERIAL_KEY = "__chatOwnedStandardMaterial";
const BASE_COLOR_HEX_KEY = "__chatBaseColorHex";

const cloneOwnedStandardMaterial = (sourceMaterial: MeshStandardMaterial) => {
  const ownedMaterial = sourceMaterial.clone();
  ownedMaterial.userData[OWNED_STANDARD_MATERIAL_KEY] = true;
  ownedMaterial.userData[BASE_COLOR_HEX_KEY] = sourceMaterial.color.getHex();
  return ownedMaterial;
};

const resolveOwnedStandardMaterial = (material: MeshStandardMaterial) =>
  material.userData[OWNED_STANDARD_MATERIAL_KEY]
    ? material
    : cloneOwnedStandardMaterial(material);

export const prepareOwnedStandardMaterials = (root: Object3D) => {
  const ownedMaterials = new Set<MeshStandardMaterial>();

  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const nextMaterials = materials.map((material) => {
      if (!(material instanceof MeshStandardMaterial)) {
        return material;
      }

      const ownedMaterial = resolveOwnedStandardMaterial(material);
      ownedMaterials.add(ownedMaterial);
      return ownedMaterial;
    });

    object.material = Array.isArray(object.material)
      ? nextMaterials
      : nextMaterials[0];
  });

  return Array.from(ownedMaterials);
};

export const resetOwnedStandardMaterialBaseColor = (
  material: MeshStandardMaterial,
) => {
  const baseColorHex = Number(
    material.userData[BASE_COLOR_HEX_KEY] ?? material.color.getHex(),
  );
  material.color.setHex(baseColorHex);
};

export const disposeOwnedStandardMaterials = (
  materials: Iterable<MeshStandardMaterial>,
) => {
  const disposed = new Set<MeshStandardMaterial>();

  for (const material of materials) {
    if (disposed.has(material)) {
      continue;
    }

    disposed.add(material);
    material.dispose();
  }
};
