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
        if (this.tuyaAPIClientId) {
            switch (this.deviceRegion) {
                case "sg":
                    this.apiHost = "https://openapi-sg.iotbing.com";
                    break;
                case "ueaz":
                    this.apiHost = "https://openapi-ueaz.tuyaus.com";
                    break;
                case "weaz":
                    this.apiHost = "https://openapi-weaz.tuyaeu.com";
                    break;
                default:
                    this.apiHost = `https://openapi.tuya${this.deviceRegion}.com`;
            }
        } else {
            this.apiHost = "";
        }

        this.localKey = config.smartIR[index].localKey ?? "";
        this.ip = config.smartIR[index].ip;
        this.version = config.smartIR[index].version ?? "3.3";
        this.acDPMapping = config.smartIR[index].acDPMapping ?? { power: 2, mode: 4, temp: 8, wind: 6 };
    }
}
