import { Logger } from "homebridge";

interface QueuedCommand {
    remoteId: string;
    commandCode: string;
    execute: (done: () => void) => void;
    enqueuedAt: number;
}

export class IrCommandQueue {
    private static queues: Map<string, QueuedCommand[]> = new Map();
    private static processing: Set<string> = new Set();
    private static delayMs = 600;
    private static readonly MAX_QUEUE_SIZE = 20;
    private static readonly COMMAND_TIMEOUT_MS = 10000;
    private static log: Logger | null = null;

    static setLogger(log: Logger): void {
        this.log = log;
    }

    static setDelay(ms: number): void {
        this.delayMs = Math.max(200, ms);
    }

    static enqueue(
        irBlasterId: string,
        remoteId: string,
        commandCode: string,
        executeFn: (done: () => void) => void,
    ): void {
        if (!this.queues.has(irBlasterId)) {
            this.queues.set(irBlasterId, []);
        }
        const queue = this.queues.get(irBlasterId)!;

        // Deduplicate: if same remoteId + commandCode already pending, replace it
        const existingIndex = queue.findIndex(
            (c) => c.remoteId === remoteId && c.commandCode === commandCode,
        );
        if (existingIndex !== -1) {
            this.log?.debug(
                `IR queue [${irBlasterId}]: dedup ${commandCode} for remote ${remoteId}`,
            );
            queue[existingIndex] = {
                remoteId,
                commandCode,
                execute: executeFn,
                enqueuedAt: Date.now(),
            };
        } else {
            // Enforce max queue size
            if (queue.length >= this.MAX_QUEUE_SIZE) {
                this.log?.warn(
                    `IR queue [${irBlasterId}]: max size reached (${this.MAX_QUEUE_SIZE}), dropping oldest command`,
                );
                queue.shift();
            }
            queue.push({
                remoteId,
                commandCode,
                execute: executeFn,
                enqueuedAt: Date.now(),
            });
        }

        this.processQueue(irBlasterId);
    }

    static shutdown(): void {
        this.queues.clear();
        this.processing.clear();
        this.log?.debug("IR command queue shutdown");
    }

    private static processQueue(irBlasterId: string): void {
        if (this.processing.has(irBlasterId)) return;
        const queue = this.queues.get(irBlasterId);
        if (!queue || queue.length === 0) return;

        this.processing.add(irBlasterId);
        const entry = queue.shift()!;

        // Skip timed-out entries
        if (Date.now() - entry.enqueuedAt > this.COMMAND_TIMEOUT_MS) {
            this.log?.warn(
                `IR queue [${irBlasterId}]: skipping timed-out ${entry.commandCode} for remote ${entry.remoteId}`,
            );
            this.processing.delete(irBlasterId);
            this.processQueue(irBlasterId);
            return;
        }

        this.log?.debug(
            `IR queue [${irBlasterId}]: sending ${entry.commandCode} to ${entry.remoteId} (${queue.length} remaining)`,
        );

        // Safety timeout: if done() is never called, force-proceed
        let completed = false;
        const safetyTimer = setTimeout(() => {
            if (!completed) {
                completed = true;
                this.log?.warn(
                    `IR queue [${irBlasterId}]: command ${entry.commandCode} timed out, proceeding`,
                );
                this.processing.delete(irBlasterId);
                this.processQueue(irBlasterId);
            }
        }, this.COMMAND_TIMEOUT_MS);

        entry.execute(() => {
            if (completed) return;
            completed = true;
            clearTimeout(safetyTimer);

            if (queue.length > 0) {
                setTimeout(() => {
                    this.processing.delete(irBlasterId);
                    this.processQueue(irBlasterId);
                }, this.delayMs);
            } else {
                this.processing.delete(irBlasterId);
            }
        });
    }
}
