import type { Server } from "node:http";

export const formatPortInUseMessage = (port: number, host: string) =>
  `[server] 端口 ${port} 已被占用，无法监听 ${host}:${port}。请先结束残留进程后再重试。`;

export const attachListenErrorHandler = (
  server: Server,
  port: number,
  host: string,
) => {
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(formatPortInUseMessage(port, host));
      process.exitCode = 1;
      return;
    }

    console.error(error);
    process.exitCode = 1;
  });
};
