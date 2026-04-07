import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TuyaIRPlatform } from '../../platform';
import { BaseAccessory } from './BaseAccessory';
/**
 * Generic Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class GenericAccessory extends BaseAccessory {
    private readonly platform;
    private readonly accessory;
    private service;
    private switchStates;
    private powerCommand;
    constructor(platform: TuyaIRPlatform, accessory: PlatformAccessory);
    /**
     * Fetch the power IR code from the cloud at startup for local dispatch.
     */
    private prefetchPowerCode;
    setOn(value: CharacteristicValue): Promise<void>;
    getOn(): CharacteristicValue;
    private sendCommand;
}
//# sourceMappingURL=GenericAccessory.d.ts.map