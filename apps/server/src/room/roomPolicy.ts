import { DEFAULT_ROOM_ID } from "@chat/protocol";

export const resolveRoomId = (requestedRoomId?: string) =>
  requestedRoomId === DEFAULT_ROOM_ID ? DEFAULT_ROOM_ID : DEFAULT_ROOM_ID;
