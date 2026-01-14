import { PlatformConfig } from "homebridge";
import { Device } from "./Device";

export class TuyaIRConfiguration {
    public tuyaAPIClientId = "";
    public tuyaAPISecret = "";
    public deviceRegion = "";
    public irDeviceId = "";
    public autoFetchRemotesFromServer = true;
    public configuredRemotes: Device[] = [];
    public apiHost = "";
    public enableStatusPolling = false;
    public statusPollingInterval = 300;

    constructor(config: PlatformConfig, index: number) {
        this.tuyaAPIClientId = config.tuyaAPIClientId;
        this.tuyaAPISecret = config.tuyaAPISecret;
        this.deviceRegion = config.deviceRegion;
        this.irDeviceId = config.smartIR[index].deviceId;
        this.autoFetchRemotesFromServer = config.smartIR[index].autoFetchRemotesFromServer;
        this.configuredRemotes = config.smartIR[index].configuredRemotes?.map(v => new Device(v));
        this.enableStatusPolling = config.enableStatusPolling ?? false;
        this.statusPollingInterval = config.statusPollingInterval ?? 300;

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
    }
}
