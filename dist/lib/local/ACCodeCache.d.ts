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
     * Falls back to searching with power=0 + any mode/temp/wind if the exact
     * combination is not found (handles ACs with a single power-off code).
     */
    static getACState(irDeviceId: string, remoteId: string, power: string, mode: string, temp: string, wind: string): string | undefined;
    /** Returns true if any AC state codes have been cached for this remote. */
    static hasACStates(irDeviceId: string, remoteId: string): boolean;
    static has(irDeviceId: string, remoteId: string): boolean;
    static size(): number;
}
//# sourceMappingURL=ACCodeCache.d.ts.map