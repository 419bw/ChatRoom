import { ROOM_THEME, type RoomTheme } from "@chat/protocol";
import { useRef } from "react";

import { RoomCanvas3D, RoomScene3D } from "./RoomScene3D";
import {
  getClientSceneQualityProfile,
  resolvePreviewSceneQualityProfile,
} from "./sceneQuality";

type RoomPreview3DProps = {
  roomTheme?: RoomTheme | null;
};

const RoomPreview3D = ({ roomTheme }: RoomPreview3DProps) => {
  const qualityRef = useRef(
    resolvePreviewSceneQualityProfile(getClientSceneQualityProfile()),
  );

  return (
    <div
      className="room-viewport room-viewport--preview"
      data-scene-mode="preview"
      data-scene-ready="true"
    >
      <RoomCanvas3D quality={qualityRef.current}>
        <RoomScene3D
          roomTheme={roomTheme ?? ROOM_THEME}
          quality={qualityRef.current}
          mode="preview"
        />
      </RoomCanvas3D>
    </div>
  );
};

export { RoomPreview3D };

export default RoomPreview3D;
