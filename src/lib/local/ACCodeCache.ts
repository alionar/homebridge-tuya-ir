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
   * Fallback order:
   *   1. Exact match (power:mode:temp:wind)
   *   2. Power-off: any entry with power=0 (handles single power-off codes)
   *   3. No-temp: mode uses 'none' temp (e.g. auto mode M2_S{fan})
   */
  static getACState(
    irDeviceId: string,
    remoteId: string,
    power: string,
    mode: string,
    temp: string,
    wind: string,
  ): string | undefined {
    const prefix = `${irDeviceId}:${remoteId}:AC:`;

    const exact = this.cache.get(`${prefix}${power}:${mode}:${temp}:${wind}`);
    if (exact) return exact;

    if (power === '0') {
      for (const [k, v] of this.cache.entries()) {
        if (k.startsWith(`${prefix}0:`)) return v;
      }
    }

    // Fallback for modes that carry no temperature (e.g. auto/fan-only)
    const noTemp = this.cache.get(`${prefix}${power}:${mode}:none:${wind}`);
    if (noTemp) return noTemp;

    return undefined;
  }

  /**
   * Find any AC remote under the given IR blaster that already has cached codes,
   * excluding the specified remote.
   */
  static findPopulatedACRemote(irDeviceId: string, excludeRemoteId: string): string | undefined {
    const excludePrefix = `${irDeviceId}:${excludeRemoteId}:AC:`;
    const parentPrefix = `${irDeviceId}:`;
    for (const key of this.cache.keys()) {
      if (!key.startsWith(parentPrefix)) continue;
      if (key.startsWith(excludePrefix)) continue;
      const after = key.slice(parentPrefix.length);
      const colonIdx = after.indexOf(':');
      if (colonIdx > 0 && after.slice(colonIdx + 1).startsWith('AC:')) {
        return after.slice(0, colonIdx);
      }
    }
    return undefined;
  }

  /**
   * Copy all AC cache entries from srcRemoteId to dstRemoteId.
   * Returns the number of entries copied.
   */
  static copyACCodes(srcRemoteId: string, dstRemoteId: string, irDeviceId: string): number {
    const srcPrefix = `${irDeviceId}:${srcRemoteId}:AC:`;
    const dstPrefix = `${irDeviceId}:${dstRemoteId}:AC:`;
    let count = 0;
    for (const [key, value] of this.cache.entries()) {
      if (key.startsWith(srcPrefix)) {
        this.cache.set(`${dstPrefix}${key.slice(srcPrefix.length)}`, value);
        count++;
      }
    }
    return count;
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
