import { PlatformConfig } from "homebridge";
import { Device } from "./Device";
export interface ACDPMapping {
    power: number;
    mode: number;
    temp: number;
    wind: number;
}
export declare class TuyaIRConfiguration {
    tuyaAPIClientId: string;
    tuyaAPISecret: string;
    deviceRegion: string;
    irDeviceId: string;
    autoFetchRemotesFromServer: boolean;
    configuredRemotes: Device[];
    apiHost: string;
    localKey: string;
    ip?: string;
    version: string;
    acDPMapping: ACDPMapping;
    constructor(config: PlatformConfig, index: number);
}
//# sourceMappingURL=TuyaIRConfiguration.d.ts.map