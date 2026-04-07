import { Logger } from 'homebridge';
export declare class LocalDeviceHelper {
    private static pool;
    static sendDPs(deviceId: string, ip: string | undefined, localKey: string, version: string, dps: Record<number, unknown>, log: Logger): Promise<void>;
    static queryDPs(deviceId: string, ip: string | undefined, localKey: string, version: string, log: Logger): Promise<Record<string, unknown>>;
    private static ensureConnected;
    static disconnect(deviceId: string): void;
}
//# sourceMappingURL=LocalDeviceHelper.d.ts.map