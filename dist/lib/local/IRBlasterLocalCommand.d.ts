import { Logger } from 'homebridge';
import { TuyaIRConfiguration } from '../model/TuyaIRConfiguration';
export interface ACStatus {
    power: string;
    mode: number;
    temp: number;
    wind: number;
}
export declare class IRBlasterLocalCommand {
    /**
     * Send an IR code (base64-encoded Tuya format) via DP 201.
     */
    static sendRawIRCode(config: TuyaIRConfiguration, base64Code: string, log: Logger): Promise<void>;
    /**
     * Query AC state from the device's data points.
     * Maps DPs to the ACStatus shape using the configured acDPMapping.
     */
    static queryACStatus(config: TuyaIRConfiguration, log: Logger): Promise<ACStatus | null>;
}
//# sourceMappingURL=IRBlasterLocalCommand.d.ts.map