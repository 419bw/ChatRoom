import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type MutableRefObject } from "react";
import { Color, Mesh, MeshBasicMaterial, Vector3 } from "three";

import {
  applyOverlayNodeState,
} from "./viewportDom";
import {
  resolveLabelOverlayState,
  shouldCommitOverlayState,
  stabilizeOverlayState,
  type StabilizedOverlayState,
} from "./overlayProjection";
import type { RoomHotspot } from "./roomHotspots";

type HotspotSystemProps = {
  hotspot: RoomHotspot | null;
  selected: boolean;
  labelRef: MutableRefObject<HTMLDivElement | null>;
};

const HotspotGroundMarker = ({
  hotspot,
  selected,
}: {
  hotspot: RoomHotspot | null;
  selected: boolean;
}) => {
  const ringRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!hotspot) {
      return;
    }

    const pulse = 1 + Math.sin(clock.elapsedTime * 2.1) * 0.08;
    const ring = ringRef.current;
    const glow = glowRef.current;
    if (ring) {
      ring.scale.setScalar(pulse);
      const material = ring.material as MeshBasicMaterial;
      material.opacity = selected ? 0.78 : 0.54;
      material.color = new Color(selected ? "#f2c78e" : "#efb883");
    }
    if (glow) {
      glow.scale.setScalar(1.06 + Math.sin(clock.elapsedTime * 1.8) * 0.12);
      const material = glow.material as MeshBasicMaterial;
      material.opacity = selected ? 0.16 : 0.1;
    }
  });

  if (!hotspot) {
    return null;
  }

  return (
    <group position={hotspot.worldCenter}>
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.34, 36]} />
        <meshBasicMaterial
          color="#f6d9b3"
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <ringGeometry args={[0.26, 0.34, 40]} />
        <meshBasicMaterial
          color="#efb883"
          transparent
          opacity={0.54}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

const HotspotLabelTracker = ({
  hotspot,
  labelRef,
}: {
  hotspot: RoomHotspot | null;
  labelRef: MutableRefObject<HTMLDivElement | null>;
}) => {
  const projectedVectorRef = useRef(new Vector3());
  const worldVectorRef = useRef(new Vector3());
  const previousStateRef = useRef<StabilizedOverlayState | null>(null);

  useEffect(() => {
    if (!hotspot || !labelRef.current) {
      return;
    }

    labelRef.current.dataset.hotspotId = hotspot.id;
  }, [hotspot, labelRef]);

  useFrame(({ camera, size }) => {
    const labelNode = labelRef.current;
    if (!labelNode) {
      return;
    }

    const nextStateInput = hotspot
      ? resolveLabelOverlayState({
          projected: projectedVectorRef.current
            .set(hotspot.worldCenter[0], hotspot.worldCenter[1] + 1.18, hotspot.worldCenter[2])
            .project(camera),
          viewport: size,
          distance: camera.position.distanceTo(
            worldVectorRef.current.set(
              hotspot.worldCenter[0],
              hotspot.worldCenter[1],
              hotspot.worldCenter[2],
            ),
          ),
          maxDistance: 18,
        })
      : {
          visible: false,
          x: previousStateRef.current?.x ?? 0,
          y: previousStateRef.current?.y ?? 0,
        };

    const nextState = stabilizeOverlayState(previousStateRef.current, nextStateInput, {
      hideHysteresisFrames: 1,
      showHysteresisFrames: 1,
    });

    if (shouldCommitOverlayState(previousStateRef.current, nextState)) {
      applyOverlayNodeState(labelNode, nextState);
    }

    previousStateRef.current = nextState;
  });

  return null;
};

export const HotspotSystem = ({
  hotspot,
  selected,
  labelRef,
}: HotspotSystemProps) => {
  if (!hotspot) {
    return null;
  }

  return (
    <>
      <HotspotGroundMarker hotspot={hotspot} selected={selected} />
      <HotspotLabelTracker hotspot={hotspot} labelRef={labelRef} />
    </>
  );
};

export default HotspotSystem;
