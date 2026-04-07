import { Logger } from "homebridge";
export declare class IrCommandQueue {
    private static queues;
    private static processing;
    private static delayMs;
    private static readonly MAX_QUEUE_SIZE;
    private static readonly COMMAND_TIMEOUT_MS;
    private static log;
    static setLogger(log: Logger): void;
    static setDelay(ms: number): void;
    static enqueue(irBlasterId: string, remoteId: string, commandCode: string, executeFn: (done: () => void) => void): void;
    static shutdown(): void;
    private static processQueue;
}
//# sourceMappingURL=IrCommandQueue.d.ts.map