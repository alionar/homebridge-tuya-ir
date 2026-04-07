/**
 * In-memory cache that maps AC command parameters to base64 IR codes.
 *
 * Populated once at startup by AirConditionerAccessory.prefetchACCodes(),
 * so all runtime commands can be dispatched locally without cloud API calls.
 *
 * Key format: "<irDeviceId>:<remoteId>:<commandName>:<value>"
 */
export declare class ACCodeCache {
    private static cache;
    static set(irDeviceId: string, remoteId: string, command: string, value: string | number, code: string): void;
    static get(irDeviceId: string, remoteId: string, command: string, value: string | number): string | undefined;
    static has(irDeviceId: string, remoteId: string): boolean;
    static size(): number;
}
//# sourceMappingURL=ACCodeCache.d.ts.map