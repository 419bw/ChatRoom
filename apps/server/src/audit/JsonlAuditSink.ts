import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import type { SystemNotice, TimelineEntry } from "@chat/protocol";

type AuditRecord =
  | {
      kind: "timeline_entry";
      entry: TimelineEntry;
    }
  | {
      kind: "system_notice";
      notice: SystemNotice;
    };

const RETRYABLE_ERROR_CODES = new Set(["EBUSY", "EPERM", "EMFILE"]);
const RETRY_DELAYS_MS = [25, 60, 120, 240] as const;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export class JsonlAuditSink {
  private readonly filePath: string;
  private readonly ensureDirPromise: Promise<void>;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(baseDir: string) {
    this.filePath = path.join(baseDir, "dialog-events.jsonl");
    this.ensureDirPromise = mkdir(path.dirname(this.filePath), { recursive: true });
  }

  async appendTimeline(entry: TimelineEntry) {
    await this.enqueue({
      kind: "timeline_entry",
      entry,
    });
  }

  async appendNotice(notice: SystemNotice) {
    await this.enqueue({
      kind: "system_notice",
      notice,
    });
  }

  private enqueue(record: AuditRecord) {
    const line = `${JSON.stringify(record)}\n`;

    // Windows 下日志文件可能会被短暂锁住，这里强制串行写入并吞掉日志侧失败。
    this.writeChain = this.writeChain
      .catch(() => undefined)
      .then(async () => {
        await this.writeWithRetry(line);
      });

    return this.writeChain;
  }

  private async writeWithRetry(line: string) {
    await this.ensureDirPromise;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        await appendFile(this.filePath, line, "utf8");
        return;
      } catch (error) {
        if (!this.isRetryable(error) || attempt === RETRY_DELAYS_MS.length) {
          console.warn("日志写入失败，已跳过本次记录：", this.toErrorMessage(error));
          return;
        }

        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  private isRetryable(error: unknown) {
    if (!error || typeof error !== "object") {
      return false;
    }

    const code = "code" in error ? error.code : undefined;
    return typeof code === "string" && RETRYABLE_ERROR_CODES.has(code);
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
