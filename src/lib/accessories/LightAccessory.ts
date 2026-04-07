import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TuyaIRPlatform } from '../../platform';
import { BaseAccessory } from './BaseAccessory';
import { APIInvocationHelper } from '../api/APIInvocationHelper';
import { IRBlasterLocalCommand } from '../local/IRBlasterLocalCommand';

/**
 * Light Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class LightAccessory extends BaseAccessory {
    private service: Service;

    private lightState = {
        On: false,
        brightness: 50
    };

    // Maps command name (PowerOn / PowerOff / Brightness+ / Brightness-)
    // to the base64 IR code fetched from cloud at startup.
    private commandCodes: Map<string, string> = new Map();

    constructor(
        private readonly platform: TuyaIRPlatform,
        private readonly accessory: PlatformAccessory,
    ) {
        super(platform, accessory);

        this.accessory?.getService(this.platform.Service.AccessoryInformation)
            ?.setCharacteristic(this.platform.Characteristic.Manufacturer, accessory.context.device.product_name)
            .setCharacteristic(this.platform.Characteristic.Model, 'Infrared Controlled Light')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);

        this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

        this.service.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.Brightness)
            .onSet(this.setBrightness.bind(this))
            .onGet(this.getBrightness.bind(this));

        if (this.configuration.localKey) {
            this.prefetchLightCodes();
        }
    }

    /**
     * Fetch IR codes for PowerOn/PowerOff/Brightness+/Brightness- at startup.
     * After this, all runtime commands are dispatched locally via DP 201.
     */
    private prefetchLightCodes(): void {
        const remoteId = this.accessory.context.device.id;
        this.log.debug(`${this.accessory.displayName}: fetching light IR codes from cloud for local dispatch...`);

        APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration,
            `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/remotes/${remoteId}/keys`,
            'GET', {},
            (keysBody) => {
                if (!keysBody.success) {
                    this.log.error(`${this.accessory.displayName}: failed to fetch light remote keys: ${keysBody.msg}. Commands will use cloud API.`);
                    return;
                }
                const { category_id, brand_id, remote_index } = keysBody.result;
                APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration,
                    `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/categories/${category_id}/brands/${brand_id}/remotes/${remote_index}/rules`,
                    'GET', {},
                    (rulesBody) => {
                        if (!rulesBody.success) {
                            this.log.warn(`${this.accessory.displayName}: failed to fetch light IR rules: ${rulesBody.msg}. Trying key_list fallback.`);
                            // Fall back to key_list from the keys response
                            for (const item of keysBody.result.key_list ?? []) {
                                const code = item.key || String(item.key_id);
                                if (code) this.commandCodes.set(item.key_name, code);
                            }
                        } else {
                            let count = 0;
                            for (const rule of rulesBody.result ?? []) {
                                const code = rule.key;
                                if (code && typeof code === 'string') {
                                    this.commandCodes.set(rule.key_name, code);
                                    count++;
                                }
                            }
                            this.log.info(`${this.accessory.displayName}: cached ${count} light IR codes for local dispatch`);
                        }
                    });
            });
    }

    private async setOn(value: CharacteristicValue) {
        if ((value as boolean) !== this.lightState.On) {
            const command = (value as boolean) ? 'PowerOn' : 'PowerOff';
            await this.sendLightCommand(command);
            this.log.info(`${this.accessory.displayName} is now ${(value as boolean) ? 'On' : 'Off'}`);
            this.lightState.On = value as boolean;
        }
    }

    private getOn() {
        return this.lightState.On;
    }

    private getBrightness() {
        return this.lightState.brightness;
    }

    private async setBrightness(value: CharacteristicValue) {
        const command = (value as number) <= this.lightState.brightness ? 'Brightness-' : 'Brightness+';
        await this.sendLightCommand(command);
        this.log.info(`${this.accessory.displayName} brightness is now ${command === 'Brightness+' ? 'increased' : 'decreased'}`);
        if (this.lightState.On) {
            this.log.debug('Resetting slider to 50%');
            this.service.updateCharacteristic(this.platform.Characteristic.Brightness, 50);
        }
    }

    private async sendLightCommand(command: string): Promise<void> {
        if (this.configuration.localKey) {
            const code = this.commandCodes.get(command);
            if (code) {
                this.log.debug(`${this.accessory.displayName}: sending light command "${command}" locally`);
                await IRBlasterLocalCommand.sendRawIRCode(this.configuration, code, this.log);
                return;
            }
            this.log.warn(`${this.accessory.displayName}: no cached IR code for "${command}", falling back to cloud`);
        }

        // Cloud fallback
        const commandObj = { commands: [{ code: command, value: 1 }] };
        await new Promise<void>((resolve) => {
            APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration,
                `${this.configuration.apiHost}/v1.0/iot-03/devices/${this.accessory.context.device.id}/commands`,
                'POST', commandObj,
                (body) => {
                    if (!body.success) {
                        this.log.error(`Failed to change ${this.accessory.displayName} via cloud: ${body.msg}`);
                    }
                    resolve();
                });
        });
    }
}
