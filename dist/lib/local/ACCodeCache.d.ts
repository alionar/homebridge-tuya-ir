/**
 * In-memory cache that maps AC states and non-AC IR key codes to base64 IR codes.
 *
 * AC entries: keyed by full AC state (power:mode:temp:wind)
 * Non-AC entries: keyed by command:value
 *
 * Populated once at startup by prefetch methods; allows all runtime commands
 * to be dispatched locally without cloud API calls.
 */
export declare class ACCodeCache {
    private static cache;
    static set(irDeviceId: string, remoteId: string, command: string, value: string | number, code: string): void;
    static get(irDeviceId: string, remoteId: string, command: string, value: string | number): string | undefined;
    /**
     * Store an IR code for a specific full AC state.
     * @param power  "0" or "1"
     * @param mode   mode index as string
     * @param temp   temperature as string
     * @param wind   fan speed as string
     */
    static setACState(irDeviceId: string, remoteId: string, power: string, mode: string, temp: string, wind: string, code: string): void;
    /**
     * Look up an IR code for the given full AC state.
     * Fallback order:
     *   1. Exact match (power:mode:temp:wind)
     *   2. Power-off: any entry with power=0 (handles single power-off codes)
     *   3. No-temp: mode uses 'none' temp (e.g. auto mode M2_S{fan})
     */
    static getACState(irDeviceId: string, remoteId: string, power: string, mode: string, temp: string, wind: string): string | undefined;
    /**
     * Find any AC remote under the given IR blaster that already has cached codes,
     * excluding the specified remote.
     */
    static findPopulatedACRemote(irDeviceId: string, excludeRemoteId: string): string | undefined;
    /**
     * Copy all AC cache entries from srcRemoteId to dstRemoteId.
     * Returns the number of entries copied.
     */
    static copyACCodes(srcRemoteId: string, dstRemoteId: string, irDeviceId: string): number;
    /** Returns true if any AC state codes have been cached for this remote. */
    static hasACStates(irDeviceId: string, remoteId: string): boolean;
    static has(irDeviceId: string, remoteId: string): boolean;
    static size(): number;
}
//# sourceMappingURL=ACCodeCache.d.ts.map