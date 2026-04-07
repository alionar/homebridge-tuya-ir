"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCodeCache = void 0;
/**
 * In-memory cache that maps AC command parameters to base64 IR codes.
 *
 * Populated once at startup by AirConditionerAccessory.prefetchACCodes(),
 * so all runtime commands can be dispatched locally without cloud API calls.
 *
 * Key format: "<irDeviceId>:<remoteId>:<commandName>:<value>"
 */
class ACCodeCache {
    static set(irDeviceId, remoteId, command, value, code) {
        this.cache.set(`${irDeviceId}:${remoteId}:${command}:${value}`, code);
    }
    static get(irDeviceId, remoteId, command, value) {
        return this.cache.get(`${irDeviceId}:${remoteId}:${command}:${value}`);
    }
    static has(irDeviceId, remoteId) {
        const prefix = `${irDeviceId}:${remoteId}:`;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix))
                return true;
        }
        return false;
    }
    static size() {
        return this.cache.size;
    }
}
exports.ACCodeCache = ACCodeCache;
ACCodeCache.cache = new Map();
//# sourceMappingURL=ACCodeCache.js.map