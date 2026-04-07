"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TuyaIRConfiguration = void 0;
const Device_1 = require("./Device");
class TuyaIRConfiguration {
    constructor(config, index) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.tuyaAPIClientId = "";
        this.tuyaAPISecret = "";
        this.deviceRegion = "";
        this.irDeviceId = "";
        this.autoFetchRemotesFromServer = true;
        this.configuredRemotes = [];
        this.apiHost = "";
        // Local control fields
        this.localKey = "";
        this.version = "3.3";
        this.acDPMapping = { power: 2, mode: 4, temp: 8, wind: 6 };
        this.tuyaAPIClientId = (_a = config.tuyaAPIClientId) !== null && _a !== void 0 ? _a : "";
        this.tuyaAPISecret = (_b = config.tuyaAPISecret) !== null && _b !== void 0 ? _b : "";
        this.deviceRegion = (_c = config.deviceRegion) !== null && _c !== void 0 ? _c : "";
        this.irDeviceId = config.smartIR[index].deviceId;
        this.autoFetchRemotesFromServer = config.smartIR[index].autoFetchRemotesFromServer;
        this.configuredRemotes = (_d = config.smartIR[index].configuredRemotes) === null || _d === void 0 ? void 0 : _d.map(v => new Device_1.Device(v));
        this.apiHost = this.tuyaAPIClientId ? `https://openapi.tuya${this.deviceRegion}.com` : "";
        this.localKey = (_e = config.smartIR[index].localKey) !== null && _e !== void 0 ? _e : "";
        this.ip = config.smartIR[index].ip;
        this.version = (_f = config.smartIR[index].version) !== null && _f !== void 0 ? _f : "3.3";
        this.acDPMapping = (_g = config.smartIR[index].acDPMapping) !== null && _g !== void 0 ? _g : { power: 2, mode: 4, temp: 8, wind: 6 };
    }
}
exports.TuyaIRConfiguration = TuyaIRConfiguration;
//# sourceMappingURL=TuyaIRConfiguration.js.map