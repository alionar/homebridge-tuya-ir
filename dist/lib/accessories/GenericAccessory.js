"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericAccessory = void 0;
const APIInvocationHelper_1 = require("../api/APIInvocationHelper");
const BaseAccessory_1 = require("./BaseAccessory");
const IRBlasterLocalCommand_1 = require("../local/IRBlasterLocalCommand");
/**
 * Generic Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class GenericAccessory extends BaseAccessory_1.BaseAccessory {
    constructor(platform, accessory) {
        var _a;
        super(platform, accessory);
        this.platform = platform;
        this.accessory = accessory;
        this.switchStates = {
            On: this.platform.Characteristic.Active.INACTIVE
        };
        // raw_key integer (for cloud fallback) or base64 IR code (for local dispatch)
        this.powerCommand = 1;
        (_a = this.accessory.getService(this.platform.Service.AccessoryInformation)) === null || _a === void 0 ? void 0 : _a.setCharacteristic(this.platform.Characteristic.Manufacturer, accessory.context.device.product_name).setCharacteristic(this.platform.Characteristic.Model, 'Infrared Controlled Switch').setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);
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
    prefetchPowerCode() {
        const remoteId = this.accessory.context.device.id;
        this.log.debug(`${this.accessory.displayName}: fetching generic remote IR codes from cloud...`);
        APIInvocationHelper_1.APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/remotes/${remoteId}/keys`, 'GET', {}, (keysBody) => {
            if (!keysBody.success) {
                this.log.error(`${this.accessory.displayName}: failed to fetch remote keys: ${keysBody.msg}. Will use cloud for commands.`);
                return;
            }
            const { category_id, brand_id, remote_index } = keysBody.result;
            APIInvocationHelper_1.APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/categories/${category_id}/brands/${brand_id}/remotes/${remote_index}/rules`, 'GET', {}, (rulesBody) => {
                var _a, _b;
                if (!rulesBody.success) {
                    this.log.warn(`${this.accessory.displayName}: failed to fetch IR rules: ${rulesBody.msg}. Trying key_list fallback.`);
                    const powerItem = ((_a = keysBody.result.key_list) !== null && _a !== void 0 ? _a : []).find(item => item.key_name === 'power');
                    if (powerItem) {
                        this.powerCommand = powerItem.key || powerItem.key_id || this.powerCommand;
                    }
                    return;
                }
                const powerRule = ((_b = rulesBody.result) !== null && _b !== void 0 ? _b : []).find(rule => rule.key_name === 'power');
                if (powerRule === null || powerRule === void 0 ? void 0 : powerRule.key) {
                    this.powerCommand = powerRule.key;
                    this.log.info(`${this.accessory.displayName}: cached power IR code for local dispatch`);
                }
            });
        });
    }
    async setOn(value) {
        if (this.switchStates.On != value) {
            await this.sendCommand(this.powerCommand);
            this.log.info(`${this.accessory.displayName} is now ${value == 0 ? 'Off' : 'On'}`);
            this.switchStates.On = value;
        }
    }
    getOn() {
        return this.switchStates.On;
    }
    async sendCommand(command) {
        if (this.configuration.localKey) {
            this.log.debug(`${this.accessory.displayName}: sending command locally`);
            await IRBlasterLocalCommand_1.IRBlasterLocalCommand.sendRawIRCode(this.configuration, String(command), this.log);
            return;
        }
        // Cloud fallback
        const commandObj = { raw_key: command };
        await new Promise((resolve) => {
            APIInvocationHelper_1.APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, `${this.configuration.apiHost}/v1.0/infrareds/${this.parentId}/remotes/${this.accessory.context.device.id}/raw/command`, 'POST', commandObj, (body) => {
                if (!body.success) {
                    this.log.error(`Failed to change ${this.accessory.displayName} status via cloud: ${body.msg}`);
                }
                resolve();
            });
        });
    }
}
exports.GenericAccessory = GenericAccessory;
//# sourceMappingURL=GenericAccessory.js.map