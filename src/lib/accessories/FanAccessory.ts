import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TuyaIRPlatform } from '../../platform';
import { BaseAccessory } from './BaseAccessory';
import { APIInvocationHelper } from '../api/APIInvocationHelper';
import { IRBlasterLocalCommand } from '../local/IRBlasterLocalCommand';

/**
 * Fan Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FanAccessory extends BaseAccessory {
    private service: Service;

    private fanStates = {
        On: this.platform.Characteristic.Active.INACTIVE,
        speed: 50,
        fan: 0,
        swing: this.platform.Characteristic.SwingMode.SWING_DISABLED
    };

    private powerCommand: string | number = 1;
    private speedCommand: string | number = 9367;
    private swingCommand: string | number = 9372;

    constructor(
        private readonly platform: TuyaIRPlatform,
        private readonly accessory: PlatformAccessory,
    ) {
        super(platform, accessory);

        this.accessory?.getService(this.platform.Service.AccessoryInformation)
            ?.setCharacteristic(this.platform.Characteristic.Manufacturer, accessory.context.device.product_name)
            .setCharacteristic(this.platform.Characteristic.Model, 'Infrared Controlled Fan')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);

        this.service = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

        this.service.getCharacteristic(this.platform.Characteristic.Active)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .onSet(this.setRotationSpeed.bind(this))
            .onGet(this.getRotationSpeed.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
            .onSet(this.setSwingMode.bind(this))
            .onGet(this.getSwingMode.bind(this));

        this.getFanCommands(this.parentId, accessory.context.device.id, accessory.context.device.diy, (commands) => {
            if (commands) {
                this.log.debug(`Setting DIY Commands for Fan as ${JSON.stringify(commands)}`)
                this.powerCommand = commands.power;
                this.speedCommand = commands.speed;
                this.swingCommand = commands.swing;
            } else {
                this.log.warn(`Failed to get commands for the fan. Defaulting to standard values. These may not work.`);
            }
        })
    }

    private async setOn(value: CharacteristicValue) {
        if (this.fanStates.On != (value as number)) {
            await this.sendFanCommand(this.powerCommand);
            this.log.info(`${this.accessory.displayName} is now ${(value as number) == 0 ? 'Off' : 'On'}`);
            this.fanStates.On = value as number;
            if (this.fanStates.On) {
                this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 50);
            }
        }
    }

    private getOn() {
        return this.fanStates.On;
    }

    private getRotationSpeed() {
        return this.fanStates.speed;
    }

    private async setRotationSpeed() {
        await this.sendFanCommand(this.speedCommand);
        this.log.info(`${this.accessory.displayName} speed is updated.`);
        this.fanStates.speed = 50;
        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, 50);
    }

    private getSwingMode() {
        return this.fanStates.swing;
    }

    private async setSwingMode(value: CharacteristicValue) {
        await this.sendFanCommand(this.swingCommand);
        this.log.info(`${this.accessory.displayName} swing is updated.`);
        this.fanStates.swing = (value as number);
    }

    private getFanCommands(irDeviceId: string, remoteId: string, isDiy = false, callback) {
        this.log.debug("Getting commands for Fan...");
        if (isDiy) {
            this.log.debug("Getting commands for DIY Fan...");
            APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, this.configuration.apiHost + `/v2.0/infrareds/${irDeviceId}/remotes/${remoteId}/learning-codes`, "GET", {}, (codesBody) => {
                if (codesBody.success) {
                    this.log.debug("Received codes. Returning all available codes");
                    callback(this.getIRCodesFromAPIResponse(codesBody));
                } else {
                    this.log.error("Failed to get codes for DIY Fan", codesBody.msg);
                    callback();
                }
            });
        } else {
            this.log.debug("First getting brand id and remote id for given device...");
            APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, `${this.configuration.apiHost}/v2.0/infrareds/${irDeviceId}/remotes/${remoteId}/keys`, 'GET', {}, (body) => {
                if (body.success) {
                    this.log.debug(`Found category id: ${body.result.category_id}, brand id: ${body.result.brand_id}, remote id: ${body.result.remote_index}`);
                    APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, this.configuration.apiHost + `/v2.0/infrareds/${irDeviceId}/categories/${body.result.category_id}/brands/${body.result.brand_id}/remotes/${body.result.remote_index}/rules`, "GET", {}, (codesBody) => {
                        if (codesBody.success) {
                            this.log.debug("Received codes. Returning all available codes");
                            callback(this.getIRCodesFromAPIResponse(codesBody));
                        } else {
                            this.log.warn("Failed to get custom codes for fan. Trying to use standard codes...", codesBody.msg);
                            callback(this.getStandardIRCodesFromAPIResponse(body));
                        }
                    });
                } else {
                    this.log.error("Failed to get fan key details", body.msg);
                    callback();
                }
            });
        }
    }

    private async sendFanCommand(command: string | number): Promise<void> {
        const code = String(command);
        if (this.configuration.localKey) {
            this.log.debug(`${this.accessory.displayName}: sending fan command locally`);
            await IRBlasterLocalCommand.sendRawIRCode(this.configuration, code, this.log);
            return;
        }

        // Cloud fallback
        const isDiy = this.accessory.context.device.diy;
        const sendCommandAPIURL = isDiy
            ? `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/remotes/${this.accessory.context.device.id}/learning-codes`
            : `${this.configuration.apiHost}/v1.0/infrareds/${this.parentId}/remotes/${this.accessory.context.device.id}/raw/command`;
        const sendCommandKey = isDiy ? 'code' : 'raw_key';
        const commandObj = { [sendCommandKey]: command };
        await new Promise<void>((resolve) => {
            APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, sendCommandAPIURL, "POST", commandObj, (body) => {
                if (!body.success) {
                    this.log.error(`Failed to send fan command via cloud: ${body.msg}`);
                }
                resolve();
            });
        });
    }

    private getIRCodeFromKey(item, key: string): string | number | null {
        if (item.key_name === key) {
            // Prefer the actual IR code (key field) over numeric key_id for local dispatch
            return item.key || item.key_id || null;
        }
        return null;
    }

    private getIRCodesFromAPIResponse(apiResponse) {
        const ret: { power: string | number; speed: string | number; swing: string | number } = {
            power: this.powerCommand,
            speed: this.speedCommand,
            swing: this.swingCommand,
        };
        for (let i = 0; i < apiResponse.result.length; i++) {
            const codeItem = apiResponse.result[i];
            ret.power = ret.power || this.getIRCodeFromKey(codeItem, "power") || this.powerCommand;
            ret.speed = ret.speed || this.getIRCodeFromKey(codeItem, "fan_speed") || this.speedCommand;
            ret.swing = ret.swing || this.getIRCodeFromKey(codeItem, "swing") || this.swingCommand;
        }
        return ret;
    }

    private getStandardIRCodesFromAPIResponse(apiResponse) {
        const ret: { power: string | number; speed: string | number; swing: string | number } = {
            power: this.powerCommand,
            speed: this.speedCommand,
            swing: this.swingCommand,
        };
        for (let i = 0; i < apiResponse.result.key_list.length; i++) {
            const codeItem = apiResponse.result.key_list[i];
            ret.power = ret.power || this.getIRCodeFromKey(codeItem, "power") || this.powerCommand;
            ret.speed = ret.speed || this.getIRCodeFromKey(codeItem, "fan_speed") || this.speedCommand;
            ret.swing = ret.swing || this.getIRCodeFromKey(codeItem, "swing") || this.swingCommand;
        }
        return ret;
    }
}
