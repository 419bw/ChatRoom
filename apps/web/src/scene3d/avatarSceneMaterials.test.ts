import { describe, expect, test, vi } from "vitest";
import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

import { avatarColorMap } from "./assetManifest";
import { syncAvatarSceneMaterials } from "./avatarSceneMaterials";
import {
  disposeOwnedStandardMaterials,
  prepareOwnedStandardMaterials,
} from "./ownedStandardMaterials";

const createAvatarScene = () => {
  const scene = new Group();
  const body = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ color: "#ffffff" }),
  );
  const hair = new Mesh(
    new SphereGeometry(0.5),
    new MeshStandardMaterial({ color: "#cccccc" }),
  );

  body.name = "Body";
  hair.name = "Hair";
  scene.add(body, hair);

  return {
    scene,
    body,
    hair,
  };
};

describe("avatarSceneMaterials", () => {
  test("换装时会复用已拥有材质而不是重复克隆", () => {
    const { scene, body, hair } = createAvatarScene();
    const ownedMaterials = prepareOwnedStandardMaterials(scene);
    const originalBodyMaterial = body.material as MeshStandardMaterial;
    const originalHairMaterial = hair.material as MeshStandardMaterial;

    syncAvatarSceneMaterials({
      root: scene,
      cosmetic: "apricot",
      enableShadows: true,
    });
    const ownedMaterialsAfterPaletteChange = prepareOwnedStandardMaterials(scene);
    syncAvatarSceneMaterials({
      root: scene,
      cosmetic: "mint",
      enableShadows: false,
    });

    expect(ownedMaterialsAfterPaletteChange).toHaveLength(ownedMaterials.length);
    expect(body.material).toBe(originalBodyMaterial);
    expect(hair.material).toBe(originalHairMaterial);
    expect((body.material as MeshStandardMaterial).color.getHexString()).toBe(
      new Color(avatarColorMap.mint.body).getHexString(),
    );
    expect((hair.material as MeshStandardMaterial).color.getHexString()).toBe(
      new Color(avatarColorMap.mint.hair).getHexString(),
    );
    expect(body.castShadow).toBe(false);
    expect(hair.receiveShadow).toBe(false);
  });

  test("释放拥有材质时会去重并调用 dispose", () => {
    const { scene } = createAvatarScene();
    const ownedMaterials = prepareOwnedStandardMaterials(scene);
    const disposeSpy = vi.spyOn(ownedMaterials[0], "dispose");

    disposeOwnedStandardMaterials([ownedMaterials[0], ownedMaterials[0]]);

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
