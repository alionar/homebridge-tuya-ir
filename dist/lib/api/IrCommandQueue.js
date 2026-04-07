"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IrCommandQueue = void 0;
class IrCommandQueue {
    static setLogger(log) {
        this.log = log;
    }
    static setDelay(ms) {
        this.delayMs = Math.max(200, ms);
    }
    static enqueue(irBlasterId, remoteId, commandCode, executeFn) {
        var _a, _b;
        if (!this.queues.has(irBlasterId)) {
            this.queues.set(irBlasterId, []);
        }
        const queue = this.queues.get(irBlasterId);
        // Deduplicate: if same remoteId + commandCode already pending, replace it
        const existingIndex = queue.findIndex((c) => c.remoteId === remoteId && c.commandCode === commandCode);
        if (existingIndex !== -1) {
            (_a = this.log) === null || _a === void 0 ? void 0 : _a.debug(`IR queue [${irBlasterId}]: dedup ${commandCode} for remote ${remoteId}`);
            queue[existingIndex] = {
                remoteId,
                commandCode,
                execute: executeFn,
                enqueuedAt: Date.now(),
            };
        }
        else {
            // Enforce max queue size
            if (queue.length >= this.MAX_QUEUE_SIZE) {
                (_b = this.log) === null || _b === void 0 ? void 0 : _b.warn(`IR queue [${irBlasterId}]: max size reached (${this.MAX_QUEUE_SIZE}), dropping oldest command`);
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
    static shutdown() {
        var _a;
        this.queues.clear();
        this.processing.clear();
        (_a = this.log) === null || _a === void 0 ? void 0 : _a.debug("IR command queue shutdown");
    }
    static processQueue(irBlasterId) {
        var _a, _b;
        if (this.processing.has(irBlasterId))
            return;
        const queue = this.queues.get(irBlasterId);
        if (!queue || queue.length === 0)
            return;
        this.processing.add(irBlasterId);
        const entry = queue.shift();
        // Skip timed-out entries
        if (Date.now() - entry.enqueuedAt > this.COMMAND_TIMEOUT_MS) {
            (_a = this.log) === null || _a === void 0 ? void 0 : _a.warn(`IR queue [${irBlasterId}]: skipping timed-out ${entry.commandCode} for remote ${entry.remoteId}`);
            this.processing.delete(irBlasterId);
            this.processQueue(irBlasterId);
            return;
        }
        (_b = this.log) === null || _b === void 0 ? void 0 : _b.debug(`IR queue [${irBlasterId}]: sending ${entry.commandCode} to ${entry.remoteId} (${queue.length} remaining)`);
        // Safety timeout: if done() is never called, force-proceed
        let completed = false;
        const safetyTimer = setTimeout(() => {
            var _a;
            if (!completed) {
                completed = true;
                (_a = this.log) === null || _a === void 0 ? void 0 : _a.warn(`IR queue [${irBlasterId}]: command ${entry.commandCode} timed out, proceeding`);
                this.processing.delete(irBlasterId);
                this.processQueue(irBlasterId);
            }
        }, this.COMMAND_TIMEOUT_MS);
        entry.execute(() => {
            if (completed)
                return;
            completed = true;
            clearTimeout(safetyTimer);
            if (queue.length > 0) {
                setTimeout(() => {
                    this.processing.delete(irBlasterId);
                    this.processQueue(irBlasterId);
                }, this.delayMs);
            }
            else {
                this.processing.delete(irBlasterId);
            }
        });
    }
}
exports.IrCommandQueue = IrCommandQueue;
IrCommandQueue.queues = new Map();
IrCommandQueue.processing = new Set();
IrCommandQueue.delayMs = 600;
IrCommandQueue.MAX_QUEUE_SIZE = 20;
IrCommandQueue.COMMAND_TIMEOUT_MS = 10000;
IrCommandQueue.log = null;
//# sourceMappingURL=IrCommandQueue.js.map