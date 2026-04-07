import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TuyaIRPlatform } from '../../platform';
import { BaseAccessory } from './BaseAccessory';
/**
 * Air Conditioner Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class AirConditionerAccessory extends BaseAccessory {
    private readonly platform;
    private readonly accessory;
    private service;
    private modeList;
    private modeCode;
    private acStates;
    constructor(platform: TuyaIRPlatform, accessory: PlatformAccessory);
    /**
     * Fetch the full AC IR code library from the cloud once at startup.
     * After this, all runtime commands are dispatched locally via DP 201.
     */
    private prefetchACCodes;
    getTemperatureRange(): void;
    /**
     * Poll AC status. Uses local DP query when localKey is configured,
     * falls back to cloud API otherwise.
     */
    refreshStatus(): Promise<void>;
    setOn(value: CharacteristicValue): Promise<void>;
    getOn(): CharacteristicValue;
    setHeatingCoolingState(value: CharacteristicValue): Promise<void>;
    getHeatingCoolingState(): CharacteristicValue;
    getCoolingThresholdTemperatureCharacteristic(): CharacteristicValue;
    setCoolingThresholdTemperatureCharacteristic(value: CharacteristicValue): Promise<void>;
    getRotationSpeedCharacteristic(): CharacteristicValue;
    setRotationSpeedCharacteristic(value: CharacteristicValue): Promise<void>;
    getCurrentTemperature(): CharacteristicValue;
    sendACCommand(deviceId: string, remoteId: string, command: string, value: string | number): Promise<void>;
    getACStatus(deviceId: string, remoteId: string, cb: any): void;
}
//# sourceMappingURL=AirConditionerAccessory.d.ts.map