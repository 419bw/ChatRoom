import { execFileSync } from "node:child_process";
import net from "node:net";

const requiredPorts = [
  {
    port: 3001,
    label: "@chat/server",
  },
  {
    port: 5173,
    label: "@chat/web",
  },
];

const PORT_RELEASE_WAIT_MS = 160;
const PORT_RELEASE_RETRY_COUNT = 12;

const sleep = (durationMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const isAddressInUseError = (error) =>
  Boolean(error) &&
  typeof error === "object" &&
  "code" in error &&
  error.code === "EADDRINUSE";

const assertPortAvailable = (port, label) =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      if (isAddressInUseError(error)) {
        reject(
          new Error(`[dev-preflight] 端口 ${port} 仍被占用，${label} 无法启动。`),
        );
        return;
      }

      reject(error);
    });
    server.once("listening", () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve();
      });
    });
    server.listen(port, "0.0.0.0");
  });

const parseWindowsListeningPids = (output, port) => {
  const portSuffix = `:${port}`;
  const pids = new Set();

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !line.includes("LISTENING")) {
      continue;
    }

    const columns = line.split(/\s+/);
    if (columns.length < 5) {
      continue;
    }

    const localAddress = columns[1] ?? "";
    const state = columns[3] ?? "";
    const pid = columns[4] ?? "";
    if (state !== "LISTENING" || !localAddress.endsWith(portSuffix)) {
      continue;
    }

    if (/^\d+$/.test(pid) && Number(pid) !== process.pid) {
      pids.add(Number(pid));
    }
  }

  return [...pids];
};

const resolveListeningPids = (port) => {
  if (process.platform !== "win32") {
    return [];
  }

  try {
    const output = execFileSync("netstat", ["-ano", "-p", "tcp"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parseWindowsListeningPids(output, port);
  } catch (error) {
    throw new Error(
      `[dev-preflight] 无法检查端口 ${port} 的占用进程：${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const terminatePid = (pid) => {
  if (process.platform === "win32") {
    execFileSync("taskkill", ["/PID", String(pid), "/F", "/T"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    return;
  }

  process.kill(pid, "SIGTERM");
};

const cleanupPort = async (port, label) => {
  const pids = resolveListeningPids(port);
  if (!pids.length) {
    return false;
  }

  console.log(
    `[dev-preflight] 检测到端口 ${port} 被占用，正在清理 ${label} 的残留进程：${pids.join(", ")}`,
  );

  for (const pid of pids) {
    try {
      terminatePid(pid);
    } catch (error) {
      throw new Error(
        `[dev-preflight] 清理端口 ${port} 的进程 ${pid} 失败：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  for (let attempt = 0; attempt < PORT_RELEASE_RETRY_COUNT; attempt += 1) {
    try {
      await assertPortAvailable(port, label);
      return true;
    } catch (error) {
      if (!isAddressInUseError(error) && !(error instanceof Error)) {
        throw error;
      }
    }

    await sleep(PORT_RELEASE_WAIT_MS);
  }

  await assertPortAvailable(port, label);
  return true;
};

const main = async () => {
  for (const portEntry of requiredPorts) {
    const cleaned = await cleanupPort(portEntry.port, portEntry.label);
    if (!cleaned) {
      await assertPortAvailable(portEntry.port, portEntry.label);
    }
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
