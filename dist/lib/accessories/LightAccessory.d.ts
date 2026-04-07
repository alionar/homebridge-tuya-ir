import { PlatformAccessory } from 'homebridge';
import { TuyaIRPlatform } from '../../platform';
import { BaseAccessory } from './BaseAccessory';
/**
 * Light Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class LightAccessory extends BaseAccessory {
    private readonly platform;
    private readonly accessory;
    private service;
    private lightState;
    private commandCodes;
    constructor(platform: TuyaIRPlatform, accessory: PlatformAccessory);
    /**
     * Fetch IR codes for PowerOn/PowerOff/Brightness+/Brightness- at startup.
     * After this, all runtime commands are dispatched locally via DP 201.
     */
    private prefetchLightCodes;
    private setOn;
    private getOn;
    private getBrightness;
    private setBrightness;
    private sendLightCommand;
}
//# sourceMappingURL=LightAccessory.d.ts.map