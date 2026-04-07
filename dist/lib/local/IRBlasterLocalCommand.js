"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IRBlasterLocalCommand = void 0;
const LocalDeviceHelper_1 = require("./LocalDeviceHelper");
// DP number used by Tuya IR blasters to send an IR code
const IR_SEND_DP = 201;
class IRBlasterLocalCommand {
    /**
     * Send an IR code (base64-encoded Tuya format) via DP 201.
     */
    static async sendRawIRCode(config, base64Code, log) {
        const payload = JSON.stringify({
            control: 'send_ir',
            head: '',
            key1: base64Code,
            type: 0,
            delay: 300,
        });
        await LocalDeviceHelper_1.LocalDeviceHelper.sendDPs(config.irDeviceId, config.ip, config.localKey, config.version, { [IR_SEND_DP]: payload }, log);
    }
    /**
     * Query AC state from the device's data points.
     * Maps DPs to the ACStatus shape using the configured acDPMapping.
     */
    static async queryACStatus(config, log) {
        var _a, _b, _c, _d;
        try {
            const dps = await LocalDeviceHelper_1.LocalDeviceHelper.queryDPs(config.irDeviceId, config.ip, config.localKey, config.version, log);
            const m = config.acDPMapping;
            return {
                power: String((_a = dps[m.power]) !== null && _a !== void 0 ? _a : '0'),
                mode: Number((_b = dps[m.mode]) !== null && _b !== void 0 ? _b : 0),
                temp: Number((_c = dps[m.temp]) !== null && _c !== void 0 ? _c : 16),
                wind: Number((_d = dps[m.wind]) !== null && _d !== void 0 ? _d : 0),
            };
        }
        catch (err) {
            log.error(`Failed to query AC status locally: ${err.message}`);
            return null;
        }
    }
}
exports.IRBlasterLocalCommand = IRBlasterLocalCommand;
//# sourceMappingURL=IRBlasterLocalCommand.js.map