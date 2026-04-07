import { Logger } from 'homebridge';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const TuyaDevice = require('tuyapi');

const COMMAND_TIMEOUT_MS = 5000;

interface DeviceEntry {
  device: typeof TuyaDevice;
  connectPromise: Promise<void> | null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export class LocalDeviceHelper {
  private static pool: Map<string, DeviceEntry> = new Map();

  static async sendDPs(
    deviceId: string,
    ip: string | undefined,
    localKey: string,
    version: string,
    dps: Record<number, unknown>,
    log: Logger,
  ): Promise<void> {
    const device = await this.ensureConnected(deviceId, ip, localKey, version, log);
    log.debug(`Sending DPs to ${deviceId}: ${JSON.stringify(dps)}`);
    // IR blasters don't send a status response after a DP 201 send — use
    // shouldWaitForResponse:false so tuyapi resolves immediately instead of timing out.
    await device.set({ multiple: true, data: dps, shouldWaitForResponse: false });
  }

  static async queryDPs(
    deviceId: string,
    ip: string | undefined,
    localKey: string,
    version: string,
    log: Logger,
  ): Promise<Record<string, unknown>> {
    const device = await this.ensureConnected(deviceId, ip, localKey, version, log);
    log.debug(`Querying DPs from ${deviceId}`);
    const data = await withTimeout(
      device.get({ schema: true }),
      COMMAND_TIMEOUT_MS,
    );
    return (data as { dps: Record<string, unknown> }).dps ?? {};
  }

  private static async ensureConnected(
    deviceId: string,
    ip: string | undefined,
    localKey: string,
    version: string,
    log: Logger,
  ): Promise<typeof TuyaDevice> {
    const existing = this.pool.get(deviceId);

    if (existing) {
      if (existing.connectPromise) {
        await existing.connectPromise;
      }
      return existing.device;
    }

    const device = new TuyaDevice({
      id: deviceId,
      key: localKey,
      ip: ip,
      version: version,
      issueGetOnConnect: false,
      issueRefreshOnConnect: false,
    });

    const entry: DeviceEntry = { device, connectPromise: null };
    this.pool.set(deviceId, entry);

    device.on('disconnected', () => {
      log.debug(`Device ${deviceId} disconnected. Will reconnect on next command.`);
      this.pool.delete(deviceId);
    });

    device.on('error', (err: Error) => {
      if (err.message?.includes('decrypt')) {
        log.error(`Decrypt error for device ${deviceId}. The localKey may be incorrect or has changed.`);
      } else {
        log.debug(`Device ${deviceId} error: ${err.message}`);
      }
      this.pool.delete(deviceId);
    });

    const connectPromise = (async () => {
      if (!ip) {
        log.debug(`No IP for ${deviceId}, using find() for auto-discovery...`);
        await withTimeout(device.find({ timeout: 10 }), 15000);
      }
      log.debug(`Connecting to ${deviceId}...`);
      await withTimeout(device.connect(), COMMAND_TIMEOUT_MS);
      log.debug(`Connected to ${deviceId}`);
      entry.connectPromise = null;
    })();

    entry.connectPromise = connectPromise;

    await connectPromise;
    return device;
  }

  static disconnect(deviceId: string): void {
    const entry = this.pool.get(deviceId);
    if (entry) {
      entry.device.disconnect();
      this.pool.delete(deviceId);
    }
  }
}
