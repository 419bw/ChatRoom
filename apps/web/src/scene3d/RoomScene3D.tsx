import { ROOM_THEME, type RoomEnvironmentVariant, type RoomTheme } from "@chat/protocol";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { ContactShadows, Sparkles } from "@react-three/drei";
import {
  Suspense,
  createContext,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";
import {
  ACESFilmicToneMapping,
  Color,
  EquirectangularReflectionMapping,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PMREMGenerator,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader.js";

import {
  resolveRoomEnvironmentAsset,
  resolveRoomLightingAsset,
  type ResolvedRoomEnvironmentAsset,
} from "./assetManifest";
import { smoothAlpha } from "./cameraMath";
import {
  disposeOwnedStandardMaterials,
  prepareOwnedStandardMaterials,
} from "./ownedStandardMaterials";
import { type SceneQualityProfile } from "./sceneQuality";
import { type RuntimeScenePolicy } from "./runtimeScenePolicy";

type SharedSceneMode = "interactive" | "preview";

type RoomScene3DProps = PropsWithChildren<{
  roomTheme: RoomTheme;
  quality: SceneQualityProfile;
  runtimePolicy?: RuntimeScenePolicy;
  mode: SharedSceneMode;
}>;

const SceneCanvasDprContext = createContext(1);

const configureGltfLoader = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

const isDocumentVisible = () =>
  typeof document === "undefined" || document.visibilityState === "visible";

export const useSceneGltf = (url: string) =>
  useLoader(GLTFLoader, url, configureGltfLoader) as GLTF;

const resolvePreloadRoomModelUrl = (roomVariant: RoomEnvironmentVariant) =>
  roomVariant === "mobile"
    ? "/models/warm-lounge-room.mobile.glb"
    : "/models/warm-lounge-room.desktop.glb";

const resolveDynamicResolutionBounds = (
  quality: SceneQualityProfile,
  runtimePolicy?: RuntimeScenePolicy,
) => {
  const maxDpr = Math.min(
    quality.dpr,
    runtimePolicy?.dynamicResolutionMaxDpr ?? quality.dpr,
  );
  const minDpr = Math.min(
    maxDpr,
    runtimePolicy?.dynamicResolutionMinDpr ?? quality.dynamicResolution.minDpr,
  );

  return {
    minDpr,
    maxDpr,
  };
};

export const preloadSceneAssets = (input?: {
  roomVariant?: RoomEnvironmentVariant;
}) => {
  useLoader.preload(
    GLTFLoader,
    resolvePreloadRoomModelUrl(input?.roomVariant ?? "desktop"),
    configureGltfLoader,
  );
  useLoader.preload(GLTFLoader, "/models/avatar-formal.glb", configureGltfLoader);
  useLoader.preload(TextureLoader, "/environments/warm-lounge-sunset.svg");
};

const PreviewCameraRig = () => {
  const desiredPositionRef = useRef(new Vector3(0.55, 3.85, 5.55));
  const desiredFocusRef = useRef(new Vector3(1.15, 1.25, -2.65));
  const nextPositionRef = useRef(new Vector3());
  const nextFocusRef = useRef(new Vector3());

  useFrame(({ camera, clock }, delta) => {
    if (!isDocumentVisible()) {
      return;
    }

    const clampedDelta = Math.min(delta, 1 / 24);
    const elapsed = clock.elapsedTime;
    nextPositionRef.current.set(
      0.55 + Math.sin(elapsed * 0.16) * 0.18,
      3.85 + Math.sin(elapsed * 0.29) * 0.06,
      5.55 + Math.cos(elapsed * 0.13) * 0.18,
    );
    nextFocusRef.current.set(
      1.15 + Math.sin(elapsed * 0.12) * 0.12,
      1.25 + Math.cos(elapsed * 0.19) * 0.06,
      -2.65 + Math.sin(elapsed * 0.1) * 0.1,
    );

    desiredPositionRef.current.lerp(
      nextPositionRef.current,
      smoothAlpha(clampedDelta, 1.4),
    );
    desiredFocusRef.current.lerp(
      nextFocusRef.current,
      smoothAlpha(clampedDelta, 1.1),
    );
    camera.position.copy(desiredPositionRef.current);
    camera.lookAt(desiredFocusRef.current);
  });

  return null;
};

const DynamicResolutionController = ({
  quality,
  runtimePolicy,
  activeDpr,
  onDprChange,
}: {
  quality: SceneQualityProfile;
  runtimePolicy?: RuntimeScenePolicy;
  activeDpr: number;
  onDprChange: Dispatch<SetStateAction<number>>;
}) => {
  const { gl } = useThree();
  const activeDprRef = useRef(activeDpr);
  const samplesRef = useRef<number[]>([]);
  const dprBounds = useMemo(
    () => resolveDynamicResolutionBounds(quality, runtimePolicy),
    [
      quality,
      runtimePolicy?.dynamicResolutionMaxDpr,
      runtimePolicy?.dynamicResolutionMinDpr,
    ],
  );

  useEffect(() => {
    activeDprRef.current = activeDpr;
  }, [activeDpr]);

  useEffect(() => {
    gl.shadowMap.enabled = quality.shadowMode === "directional";
    gl.shadowMap.type = PCFSoftShadowMap;
    onDprChange(dprBounds.maxDpr);
    samplesRef.current = [];
  }, [dprBounds.maxDpr, gl, onDprChange, quality.shadowMode, quality.tier]);

  useFrame((_, delta) => {
    if (!quality.dynamicResolution.enabled || !isDocumentVisible()) {
      return;
    }

    samplesRef.current.push(delta);
    if (samplesRef.current.length < quality.dynamicResolution.settleFrames) {
      return;
    }

    const averageFrameMs =
      (samplesRef.current.reduce((sum, sample) => sum + sample, 0) /
        samplesRef.current.length) *
      1000;
    samplesRef.current = [];

    const currentDpr = activeDprRef.current;
    let nextDpr = currentDpr;
    if (averageFrameMs > quality.dynamicResolution.targetFrameMs * 1.08) {
      nextDpr = Math.max(
        dprBounds.minDpr,
        currentDpr - quality.dynamicResolution.adjustStep,
      );
    } else if (
      averageFrameMs < quality.dynamicResolution.targetFrameMs * 0.78 &&
      currentDpr < dprBounds.maxDpr
    ) {
      nextDpr = Math.min(
        dprBounds.maxDpr,
        currentDpr + quality.dynamicResolution.adjustStep,
      );
    }

    if (Math.abs(nextDpr - currentDpr) < 0.05) {
      return;
    }

    const normalizedDpr = Number(nextDpr.toFixed(2));
    activeDprRef.current = normalizedDpr;
    onDprChange(normalizedDpr);
  });

  return null;
};

const SceneEnvironment = ({
  environmentAsset,
}: {
  environmentAsset: ReturnType<typeof resolveRoomLightingAsset>;
}) => {
  const { gl, scene } = useThree();
  const texture = useLoader(TextureLoader, environmentAsset.environmentMapUrl);

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.mapping = EquirectangularReflectionMapping;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;

    const pmremGenerator = new PMREMGenerator(gl);
    pmremGenerator.compileEquirectangularShader();
    const pmremTarget = pmremGenerator.fromEquirectangular(texture);
    const previousEnvironment = scene.environment;
    scene.environment = pmremTarget.texture;

    return () => {
      scene.environment = previousEnvironment;
      pmremTarget.dispose();
      pmremGenerator.dispose();
    };
  }, [environmentAsset.environmentMapUrl, gl, scene, texture]);

  return null;
};

const configureRoomMaterial = ({
  material,
  objectName,
  quality,
  mode,
  roomAsset,
  lightingAsset,
}: {
  material: MeshStandardMaterial;
  objectName: string;
  quality: SceneQualityProfile;
  mode: SharedSceneMode;
  roomAsset: ResolvedRoomEnvironmentAsset;
  lightingAsset: ReturnType<typeof resolveRoomLightingAsset>;
}) => {
  material.envMapIntensity =
    quality.roomVariant === "desktop"
      ? quality.tier === "desktop-high"
        ? 1.6
        : 1.3
      : 1.0;
  material.lightMapIntensity = lightingAsset.lightmapIntensity ?? 1.1;

  if (objectName.includes("WindowGlass")) {
    material.roughness = 0.02;
    material.metalness = 0.6;
    material.transparent = true;
    material.opacity = 0.45;
    material.envMapIntensity = 2.8;
    return;
  }

  if (objectName.includes("LampShade") || objectName.includes("LampBulb")) {
    material.roughness = 0.35;
    material.emissive = new Color("#ffaa66");
    material.emissiveIntensity = mode === "preview" ? 2.5 : 2.0;
    material.envMapIntensity = 0.8;
    return;
  }

  if (
    objectName.includes("SunPanel") ||
    objectName.includes("SunBeam") ||
    objectName.includes("SunWash")
  ) {
    material.roughness = 0.3;
    material.emissive = new Color("#ff7a2f");
    material.emissiveIntensity = mode === "preview" ? 1.2 : 0.9;
    material.envMapIntensity = 0.4;
    return;
  }

  if (objectName.includes("Rug") || objectName.includes("Curtain")) {
    material.roughness = 0.9;
    material.metalness = 0.05;
    material.envMapIntensity = 0.4;
    return;
  }

  if (objectName.includes("Sofa") || objectName.includes("Pillow")) {
    material.roughness = 0.75;
    material.metalness = 0.08;
    material.envMapIntensity = 0.45;
    return;
  }

  if (
    objectName.includes("CoffeeTable") ||
    objectName.includes("SideTable") ||
    objectName.includes("Shelf") ||
    objectName.includes("Book")
  ) {
    material.roughness = Math.min(material.roughness, 0.4);
    material.metalness = Math.max(material.metalness, 0.15);
    material.envMapIntensity = 1.6;
    return;
  }

  if (
    objectName.includes("Wall") ||
    objectName.includes("Ceiling") ||
    objectName.includes("Trim")
  ) {
    material.roughness = 0.85;
    material.metalness = 0.04;
    material.envMapIntensity = 0.35;
    return;
  }

  if (objectName.includes("Plant")) {
    material.roughness = 0.9;
    material.metalness = 0.02;
    material.envMapIntensity = 0.18;
  }
};

const shouldCastRoomShadow = (
  objectName: string,
  shadowMode: SceneQualityProfile["shadowMode"],
) =>
  shadowMode === "directional" &&
  (
    objectName.includes("CoffeeTable") ||
    objectName.includes("SideTable") ||
    objectName.includes("LampStand") ||
    objectName.includes("PlantPot")
  );

const shouldReceiveRoomShadow = (
  objectName: string,
  shadowMode: SceneQualityProfile["shadowMode"],
) =>
  shadowMode === "directional" &&
  (
    objectName.includes("Floor") ||
    objectName.includes("Rug") ||
    objectName.includes("CoffeeTable") ||
    objectName.includes("SideTable") ||
    objectName.includes("Sofa")
  );

const RoomModel = ({
  roomAsset,
  lightingAsset,
  quality,
  mode,
}: {
  roomAsset: ResolvedRoomEnvironmentAsset;
  lightingAsset: ReturnType<typeof resolveRoomLightingAsset>;
  quality: SceneQualityProfile;
  mode: SharedSceneMode;
}) => {
  const gltf = useSceneGltf(roomAsset.modelUrl);
  const preparedRoomScene = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const ownedMaterials = prepareOwnedStandardMaterials(scene);
    return {
      scene,
      ownedMaterials,
    };
  }, [gltf.scene]);

  useEffect(() => {
    return () => {
      disposeOwnedStandardMaterials(preparedRoomScene.ownedMaterials);
    };
  }, [preparedRoomScene]);

  useEffect(() => {
    preparedRoomScene.scene.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }

      object.castShadow = shouldCastRoomShadow(object.name, quality.shadowMode);
      object.receiveShadow = shouldReceiveRoomShadow(object.name, quality.shadowMode);

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const sourceMaterial of materials) {
        if (!(sourceMaterial instanceof MeshStandardMaterial)) {
          continue;
        }

        configureRoomMaterial({
          material: sourceMaterial,
          objectName: object.name,
          quality,
          mode,
          roomAsset,
          lightingAsset,
        });
      }
    });
  }, [lightingAsset, mode, preparedRoomScene, quality, roomAsset]);

  return <primitive object={preparedRoomScene.scene} scale={roomAsset.scale} />;
};

const disposeComposer = (composer: EffectComposer | null) => {
  if (!composer) {
    return;
  }

  for (const pass of composer.passes) {
    if ("dispose" in pass && typeof pass.dispose === "function") {
      pass.dispose();
    }
  }
};

const ScenePostProcessing = ({
  quality,
  runtimePolicy,
  mode,
}: {
  quality: SceneQualityProfile;
  runtimePolicy?: RuntimeScenePolicy;
  mode: SharedSceneMode;
}) => {
  const { gl, scene, camera, size } = useThree();
  const activeDpr = useContext(SceneCanvasDprContext);
  const composerRef = useRef<EffectComposer | null>(null);
  const fxaaPassRef = useRef<ShaderPass | null>(null);

  useEffect(() => {
    disposeComposer(composerRef.current);
    composerRef.current = null;
    fxaaPassRef.current = null;

    if (
      !quality.postprocessing.enabled ||
      !(runtimePolicy?.allowPostprocessing ?? true)
    ) {
      return;
    }

    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));

    if (quality.postprocessing.antialiasPass === "fxaa") {
      const fxaaPass = new ShaderPass(FXAAShader);
      composer.addPass(fxaaPass);
      fxaaPassRef.current = fxaaPass;
    }

    if (runtimePolicy?.allowBloom ?? true) {
      const bloomPass = new UnrealBloomPass(
        new Vector2(size.width, size.height),
        quality.postprocessing.bloomIntensity * (mode === "preview" ? 1.08 : 1),
        0.22,
        0.9,
      );
      composer.addPass(bloomPass);
    }

    if (quality.postprocessing.vignette && (runtimePolicy?.allowVignette ?? true)) {
      const vignettePass = new ShaderPass(VignetteShader);
      vignettePass.uniforms.offset.value = 0.9;
      vignettePass.uniforms.darkness.value = mode === "preview" ? 0.82 : 0.9;
      composer.addPass(vignettePass);
    }

    composerRef.current = composer;

    return () => {
      disposeComposer(composer);
      composerRef.current = null;
      fxaaPassRef.current = null;
    };
  }, [
    camera,
    gl,
    mode,
    quality.postprocessing.antialiasPass,
    quality.postprocessing.bloomIntensity,
    quality.postprocessing.enabled,
    quality.postprocessing.vignette,
    runtimePolicy?.allowPostprocessing,
    runtimePolicy?.allowBloom,
    runtimePolicy?.allowVignette,
    scene,
    size.height,
    size.width,
  ]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) {
      return;
    }

    composer.setPixelRatio(activeDpr);
    composer.setSize(size.width, size.height);

    if (fxaaPassRef.current) {
      fxaaPassRef.current.material.uniforms.resolution.value.set(
        1 / Math.max(size.width * activeDpr, 1),
        1 / Math.max(size.height * activeDpr, 1),
      );
    }
  }, [activeDpr, size.height, size.width]);

  useFrame((_, delta) => {
    if (!isDocumentVisible()) {
      return;
    }
    if (composerRef.current) {
      composerRef.current.render(delta);
      return;
    }
    gl.render(scene, camera);
  }, 1);

  return null;
};

export const RoomCanvas3D = ({
  quality,
  runtimePolicy,
  children,
}: PropsWithChildren<{
  quality: SceneQualityProfile;
  runtimePolicy?: RuntimeScenePolicy;
}>) => {
  const dprBounds = useMemo(
    () => resolveDynamicResolutionBounds(quality, runtimePolicy),
    [
      quality,
      runtimePolicy?.dynamicResolutionMaxDpr,
      runtimePolicy?.dynamicResolutionMinDpr,
    ],
  );
  const [activeDpr, setActiveDpr] = useState(dprBounds.maxDpr);

  useEffect(() => {
    setActiveDpr(dprBounds.maxDpr);
  }, [dprBounds.maxDpr]);

  return (
    <Canvas
      camera={{
        position: [0, 3.95, 4.9],
        fov: 42,
        near: 0.1,
        far: 100,
      }}
      dpr={activeDpr}
      shadows={quality.shadowMode === "directional"}
      gl={{
        antialias: quality.antialias && quality.postprocessing.antialiasPass === "none",
        powerPreference: quality.tier === "mobile" ? "high-performance" : "default",
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = quality.tier === "desktop-high" ? 1.05 : 1.0;
        gl.shadowMap.enabled = quality.shadowMode === "directional";
        gl.shadowMap.type = PCFSoftShadowMap;
      }}
    >
      <SceneCanvasDprContext.Provider value={activeDpr}>
        <DynamicResolutionController
          quality={quality}
          runtimePolicy={runtimePolicy}
          activeDpr={activeDpr}
          onDprChange={setActiveDpr}
        />
        {children}
      </SceneCanvasDprContext.Provider>
    </Canvas>
  );
};

export const RoomScene3D = ({
  roomTheme,
  quality,
  runtimePolicy,
  mode,
  children,
}: RoomScene3DProps) => {
  const sceneTheme = roomTheme ?? ROOM_THEME;
  const roomAsset = resolveRoomEnvironmentAsset(sceneTheme, quality.roomVariant);
  const lightingAsset = resolveRoomLightingAsset(sceneTheme);

  return (
    <>
      <SceneEnvironment environmentAsset={lightingAsset} />
      <color
        attach="background"
        args={[mode === "preview" ? "#140804" : "#1a0b06"]}
      />
      <fog
        attach="fog"
        args={[
          mode === "preview" ? "#221108" : "#1a0c06",
          quality.roomVariant === "desktop" ? 16 : 18,
          quality.roomVariant === "desktop" ? 60 : 56,
        ]}
      />
      <ambientLight
        color="#ffccaa"
        intensity={mode === "preview" ? 0.8 : 0.6}
      />
      <hemisphereLight
        color="#ffb973"
        groundColor="#2a1610"
        intensity={quality.roomVariant === "desktop" ? 0.35 : 0.28}
      />
      <directionalLight
        color="#ff8c3a"
        position={[7.8, 6.1, -6.4]}
        intensity={quality.tier === "desktop-high" ? 3.0 : 2.2}
        castShadow={quality.shadowMode === "directional"}
        shadow-mapSize-width={quality.shadowMapSize}
        shadow-mapSize-height={quality.shadowMapSize}
        shadow-bias={-0.00018}
        shadow-normalBias={0.028}
        shadow-camera-left={-6.8}
        shadow-camera-right={6.4}
        shadow-camera-top={5.9}
        shadow-camera-bottom={-5.4}
        shadow-camera-near={1}
        shadow-camera-far={22}
      />
      <directionalLight
        color="#6fa8ff"
        position={[-7.2, 5.8, 6.9]}
        intensity={mode === "preview" ? 1.2 : 0.9}
      />
      <pointLight
        color="#ffd7a6"
        position={[0.95, 2.24, -3.15]}
        intensity={mode === "preview" ? 1.46 : 1.3}
        distance={6.8}
        decay={1.82}
      />
      <pointLight
        color="#ffb96d"
        position={[5.3, 2.28, -5.84]}
        intensity={quality.roomVariant === "desktop" ? 1.42 : 1.2}
        distance={7.8}
        decay={1.95}
      />
      <pointLight
        color="#f6c492"
        position={[4.1, 1.2, -2.45]}
        intensity={quality.roomVariant === "desktop" ? 0.52 : 0.34}
        distance={4.4}
        decay={2}
      />
      <pointLight
        color="#dce6ff"
        position={[-3.2, 1.8, 1.6]}
        intensity={mode === "preview" ? 0.14 : 0.1}
        distance={7}
        decay={2.4}
      />
      {mode === "preview" ? <PreviewCameraRig /> : null}
      <Suspense fallback={null}>
        <RoomModel
          roomAsset={roomAsset}
          lightingAsset={lightingAsset}
          quality={quality}
          mode={mode}
        />
        {quality.tier === "desktop-high" && (
          <>
            <ContactShadows resolution={1024} position={[0, 0.05, 0]} opacity={0.6} scale={14} blur={1.5} far={2.8} />
            <Sparkles count={45} scale={8} size={2.5} speed={0.4} opacity={0.15} color="#ffb066" position={[0, 1.5, 0]} />
          </>
        )}
      </Suspense>
      {children}
      <ScenePostProcessing quality={quality} runtimePolicy={runtimePolicy} mode={mode} />
    </>
  );
};
