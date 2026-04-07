import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TuyaIRPlatform } from '../../platform';
import { APIInvocationHelper } from '../api/APIInvocationHelper';
import { BaseAccessory } from './BaseAccessory';
import { IRBlasterLocalCommand } from '../local/IRBlasterLocalCommand';

/**
 * Generic Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class GenericAccessory extends BaseAccessory {
    private service: Service;
    private switchStates = {
        On: this.platform.Characteristic.Active.INACTIVE
    };

    // raw_key integer (for cloud fallback) or base64 IR code (for local dispatch)
    private powerCommand: string | number = 1;

    constructor(
        private readonly platform: TuyaIRPlatform,
        private readonly accessory: PlatformAccessory,
    ) {
        super(platform, accessory);

        this.accessory.getService(this.platform.Service.AccessoryInformation)
            ?.setCharacteristic(this.platform.Characteristic.Manufacturer, accessory.context.device.product_name)
            .setCharacteristic(this.platform.Characteristic.Model, 'Infrared Controlled Switch')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);

        this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

        this.service.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));

        if (this.configuration.localKey) {
            this.prefetchPowerCode();
        }
    }

    /**
     * Fetch the power IR code from the cloud at startup for local dispatch.
     */
    private prefetchPowerCode(): void {
        const remoteId = this.accessory.context.device.id;
        this.log.debug(`${this.accessory.displayName}: fetching generic remote IR codes from cloud...`);

        APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration,
            `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/remotes/${remoteId}/keys`,
            'GET', {},
            (keysBody) => {
                if (!keysBody.success) {
                    this.log.error(`${this.accessory.displayName}: failed to fetch remote keys: ${keysBody.msg}. Will use cloud for commands.`);
                    return;
                }
                const { category_id, brand_id, remote_index } = keysBody.result;
                APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration,
                    `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/categories/${category_id}/brands/${brand_id}/remotes/${remote_index}/rules`,
                    'GET', {},
                    (rulesBody) => {
                        if (!rulesBody.success) {
                            this.log.warn(`${this.accessory.displayName}: failed to fetch IR rules: ${rulesBody.msg}. Trying key_list fallback.`);
                            const powerItem = (keysBody.result.key_list ?? []).find(item => item.key_name === 'power');
                            if (powerItem) {
                                this.powerCommand = powerItem.key || powerItem.key_id || this.powerCommand;
                            }
                            return;
                        }
                        const powerRule = (rulesBody.result ?? []).find(rule => rule.key_name === 'power');
                        if (powerRule?.key) {
                            this.powerCommand = powerRule.key;
                            this.log.info(`${this.accessory.displayName}: cached power IR code for local dispatch`);
                        }
                    });
            });
    }

    async setOn(value: CharacteristicValue) {
        if (this.switchStates.On != (value as number)) {
            await this.sendCommand(this.powerCommand);
            this.log.info(`${this.accessory.displayName} is now ${(value as number) == 0 ? 'Off' : 'On'}`);
            this.switchStates.On = value as number;
        }
    }

    getOn(): CharacteristicValue {
        return this.switchStates.On;
    }

    private async sendCommand(command: string | number): Promise<void> {
        if (this.configuration.localKey) {
            this.log.debug(`${this.accessory.displayName}: sending command locally`);
            await IRBlasterLocalCommand.sendRawIRCode(this.configuration, String(command), this.log);
            return;
        }

        // Cloud fallback
        const commandObj = { raw_key: command };
        await new Promise<void>((resolve) => {
            APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration,
                `${this.configuration.apiHost}/v1.0/infrareds/${this.parentId}/remotes/${this.accessory.context.device.id}/raw/command`,
                'POST', commandObj,
                (body) => {
                    if (!body.success) {
                        this.log.error(`Failed to change ${this.accessory.displayName} status via cloud: ${body.msg}`);
                    }
                    resolve();
                });
        });
    }
}
