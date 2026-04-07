/**
 * In-memory cache that maps AC states and non-AC IR key codes to base64 IR codes.
 *
 * AC entries: keyed by full AC state (power:mode:temp:wind)
 * Non-AC entries: keyed by command:value
 *
 * Populated once at startup by prefetch methods; allows all runtime commands
 * to be dispatched locally without cloud API calls.
 */
export class ACCodeCache {
  private static cache: Map<string, string> = new Map();

  // ── Non-AC (fan, light, generic) ──────────────────────────────────────────

  static set(
    irDeviceId: string,
    remoteId: string,
    command: string,
    value: string | number,
    code: string,
  ): void {
    this.cache.set(`${irDeviceId}:${remoteId}:${command}:${value}`, code);
  }

  static get(
    irDeviceId: string,
    remoteId: string,
    command: string,
    value: string | number,
  ): string | undefined {
    return this.cache.get(`${irDeviceId}:${remoteId}:${command}:${value}`);
  }

  // ── AC full-state entries ─────────────────────────────────────────────────

  /**
   * Store an IR code for a specific full AC state.
   * @param power  "0" or "1"
   * @param mode   mode index as string
   * @param temp   temperature as string
   * @param wind   fan speed as string
   */
  static setACState(
    irDeviceId: string,
    remoteId: string,
    power: string,
    mode: string,
    temp: string,
    wind: string,
    code: string,
  ): void {
    this.cache.set(`${irDeviceId}:${remoteId}:AC:${power}:${mode}:${temp}:${wind}`, code);
  }

  /**
   * Look up an IR code for the given full AC state.
   * Falls back to searching with power=0 + any mode/temp/wind if the exact
   * combination is not found (handles ACs with a single power-off code).
   */
  static getACState(
    irDeviceId: string,
    remoteId: string,
    power: string,
    mode: string,
    temp: string,
    wind: string,
  ): string | undefined {
    const exact = this.cache.get(`${irDeviceId}:${remoteId}:AC:${power}:${mode}:${temp}:${wind}`);
    if (exact) return exact;

    // When turning off, many ACs use the same IR code regardless of mode/temp/wind.
    // Scan for any power=0 entry as a fallback.
    if (power === '0') {
      const prefix = `${irDeviceId}:${remoteId}:AC:0:`;
      for (const [k, v] of this.cache.entries()) {
        if (k.startsWith(prefix)) return v;
      }
    }

    return undefined;
  }

  /** Returns true if any AC state codes have been cached for this remote. */
  static hasACStates(irDeviceId: string, remoteId: string): boolean {
    const prefix = `${irDeviceId}:${remoteId}:AC:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  // ── Generic helpers ───────────────────────────────────────────────────────

  static has(irDeviceId: string, remoteId: string): boolean {
    const prefix = `${irDeviceId}:${remoteId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  static size(): number {
    return this.cache.size;
  }
}
