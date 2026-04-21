import { type RoomService } from "@chat/core";

import { RoomSessionRegistry } from "./RoomSessionRegistry";

export class RoomManager {
  constructor(private readonly sessionRegistry = new RoomSessionRegistry()) {}

  createRoom(roomId: string) {
    return this.sessionRegistry.create(roomId);
  }

  getRoom(roomId: string): RoomService {
    return this.sessionRegistry.get(roomId);
  }
}
