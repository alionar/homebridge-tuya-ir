/**
 * In-memory cache that maps AC command parameters to base64 IR codes.
 *
 * Populated once at startup by AirConditionerAccessory.prefetchACCodes(),
 * so all runtime commands can be dispatched locally without cloud API calls.
 *
 * Key format: "<irDeviceId>:<remoteId>:<commandName>:<value>"
 */
export class ACCodeCache {
  private static cache: Map<string, string> = new Map();

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
