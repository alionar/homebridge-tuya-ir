"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalDeviceHelper = void 0;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TuyaDevice = require('tuyapi');
const COMMAND_TIMEOUT_MS = 5000;
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)),
    ]);
}
class LocalDeviceHelper {
    static async sendDPs(deviceId, ip, localKey, version, dps, log) {
        const device = await this.ensureConnected(deviceId, ip, localKey, version, log);
        log.debug(`Sending DPs to ${deviceId}: ${JSON.stringify(dps)}`);
        // IR blasters don't send a status response after a DP 201 send — use
        // shouldWaitForResponse:false so tuyapi resolves immediately instead of timing out.
        await device.set({ multiple: true, data: dps, shouldWaitForResponse: false });
    }
    static async queryDPs(deviceId, ip, localKey, version, log) {
        var _a;
        const device = await this.ensureConnected(deviceId, ip, localKey, version, log);
        log.debug(`Querying DPs from ${deviceId}`);
        const data = await withTimeout(device.get({ schema: true }), COMMAND_TIMEOUT_MS);
        return (_a = data.dps) !== null && _a !== void 0 ? _a : {};
    }
    static async ensureConnected(deviceId, ip, localKey, version, log) {
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
        const entry = { device, connectPromise: null };
        this.pool.set(deviceId, entry);
        device.on('disconnected', () => {
            log.debug(`Device ${deviceId} disconnected. Will reconnect on next command.`);
            this.pool.delete(deviceId);
        });
        device.on('error', (err) => {
            var _a;
            if ((_a = err.message) === null || _a === void 0 ? void 0 : _a.includes('decrypt')) {
                log.error(`Decrypt error for device ${deviceId}. The localKey may be incorrect or has changed.`);
            }
            else {
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
    static disconnect(deviceId) {
        const entry = this.pool.get(deviceId);
        if (entry) {
            entry.device.disconnect();
            this.pool.delete(deviceId);
        }
    }
}
exports.LocalDeviceHelper = LocalDeviceHelper;
LocalDeviceHelper.pool = new Map();
//# sourceMappingURL=LocalDeviceHelper.js.map