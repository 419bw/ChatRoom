export const JOIN_ROOM_TIMEOUT_MS = 9000;

export type ConnectionErrorKind = "connect_error" | "join_timeout" | "disconnect";

const isServerUnavailableMessage = (message: string) =>
  /websocket|transport|econnrefused|failed|network/i.test(message);

export const resolveConnectionErrorMessage = (
  kind: ConnectionErrorKind,
  error?: { message?: string | null } | null,
) => {
  if (kind === "join_timeout") {
    return "进入房间超时，请确认房间服务已启动后重试。";
  }

  if (kind === "disconnect") {
    return "连接已断开，请重新进入房间。";
  }

  const rawMessage = error?.message?.trim();
  if (rawMessage && isServerUnavailableMessage(rawMessage)) {
    return "无法连接房间服务，请先启动本地服务器后重试。";
  }

  if (rawMessage) {
    return `连接房间失败：${rawMessage}`;
  }

  return "无法连接房间服务，请先启动本地服务器后重试。";
};
