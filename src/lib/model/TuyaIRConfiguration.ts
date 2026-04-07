import { PlatformConfig } from "homebridge";
import { Device } from "./Device";

export interface ACDPMapping {
  power: number;
  mode: number;
  temp: number;
  wind: number;
}

export class TuyaIRConfiguration {
    public tuyaAPIClientId = "";
    public tuyaAPISecret = "";
    public deviceRegion = "";
    public irDeviceId = "";
    public autoFetchRemotesFromServer = true;
    public configuredRemotes: Device[] = [];
    public apiHost = "";

    // Local control fields
    public localKey = "";
    public ip?: string;
    public version = "3.3";
    public acDPMapping: ACDPMapping = { power: 2, mode: 4, temp: 8, wind: 6 };

    constructor(config: PlatformConfig, index: number) {
        this.tuyaAPIClientId = config.tuyaAPIClientId ?? "";
        this.tuyaAPISecret = config.tuyaAPISecret ?? "";
        this.deviceRegion = config.deviceRegion ?? "";
        this.irDeviceId = config.smartIR[index].deviceId;
        this.autoFetchRemotesFromServer = config.smartIR[index].autoFetchRemotesFromServer;
        this.configuredRemotes = config.smartIR[index].configuredRemotes?.map(v => new Device(v));
        this.apiHost = this.tuyaAPIClientId ? `https://openapi.tuya${this.deviceRegion}.com` : "";

        this.localKey = config.smartIR[index].localKey ?? "";
        this.ip = config.smartIR[index].ip;
        this.version = config.smartIR[index].version ?? "3.3";
        this.acDPMapping = config.smartIR[index].acDPMapping ?? { power: 2, mode: 4, temp: 8, wind: 6 };
    }
}
