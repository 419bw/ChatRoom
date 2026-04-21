import { createRoom, type RoomService } from "@chat/core";

export class RoomSessionRegistry {
  private readonly rooms = new Map<string, RoomService>();

  create(roomId: string) {
    const room = createRoom(roomId);
    this.rooms.set(roomId, room);
    return room;
  }

  get(roomId: string) {
    const existing = this.rooms.get(roomId);
    if (existing) {
      return existing;
    }

    return this.create(roomId);
  }
}
