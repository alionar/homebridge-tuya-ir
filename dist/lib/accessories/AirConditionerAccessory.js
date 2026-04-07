"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AirConditionerAccessory = void 0;
const BaseAccessory_1 = require("./BaseAccessory");
const APIInvocationHelper_1 = require("../api/APIInvocationHelper");
const IRBlasterLocalCommand_1 = require("../local/IRBlasterLocalCommand");
const ACCodeCache_1 = require("../local/ACCodeCache");
/**
 * Air Conditioner Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class AirConditionerAccessory extends BaseAccessory_1.BaseAccessory {
    constructor(platform, accessory) {
        var _a;
        super(platform, accessory);
        this.platform = platform;
        this.accessory = accessory;
        this.modeList = ['Cool', 'Heat', 'Auto'];
        this.modeCode = [];
        this.acStates = {
            On: false,
            temperature: 16,
            fan: 0,
            mode: 0,
        };
        this.modeCode = [];
        this.modeCode.push(this.platform.Characteristic.TargetHeaterCoolerState.COOL);
        this.modeCode.push(this.platform.Characteristic.TargetHeaterCoolerState.HEAT);
        this.modeCode.push(this.platform.Characteristic.TargetHeaterCoolerState.AUTO);
        (_a = this.accessory
            .getService(this.platform.Service.AccessoryInformation)) === null || _a === void 0 ? void 0 : _a.setCharacteristic(this.platform.Characteristic.Manufacturer, accessory.context.device.brand || 'Unknown').setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.model || 'Unknown').setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);
        this.service =
            this.accessory.getService(this.platform.Service.HeaterCooler) ||
                this.accessory.addService(this.platform.Service.HeaterCooler);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
        this.service
            .getCharacteristic(this.platform.Characteristic.Active)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
            .onSet(this.setHeatingCoolingState.bind(this))
            .onGet(this.getHeatingCoolingState.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.getCurrentTemperature.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
            .onGet(this.getCoolingThresholdTemperatureCharacteristic.bind(this))
            .onSet(this.setCoolingThresholdTemperatureCharacteristic.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .onGet(this.getCoolingThresholdTemperatureCharacteristic.bind(this))
            .onSet(this.setCoolingThresholdTemperatureCharacteristic.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .setProps({
            unit: undefined,
            minValue: 0,
            maxValue: 3,
            minStep: 1,
        })
            .onGet(this.getRotationSpeedCharacteristic.bind(this))
            .onSet(this.setRotationSpeedCharacteristic.bind(this));
        if (this.configuration.localKey) {
            this.prefetchACCodes();
        }
        else {
            this.log.warn(`${this.accessory.displayName}: no localKey configured, AC commands will use cloud API`);
        }
        this.refreshStatus();
        this.getTemperatureRange();
    }
    /**
     * Fetch the full AC IR code library from the cloud once at startup.
     * After this, all runtime commands are dispatched locally via DP 201.
     */
    prefetchACCodes() {
        const remoteId = this.accessory.context.device.id;
        if (ACCodeCache_1.ACCodeCache.hasACStates(this.parentId, remoteId)) {
            this.log.debug(`${this.accessory.displayName}: AC codes already cached`);
            return;
        }
        this.log.debug(`${this.accessory.displayName}: fetching AC IR codes from cloud for local dispatch...`);
        APIInvocationHelper_1.APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/remotes/${remoteId}/keys`, 'GET', {}, (keysBody) => {
            if (!keysBody.success) {
                this.log.error(`${this.accessory.displayName}: failed to fetch AC remote keys: ${keysBody.msg}. AC commands will use cloud API.`);
                return;
            }
            const { category_id, brand_id, remote_index } = keysBody.result;
            APIInvocationHelper_1.APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/categories/${category_id}/brands/${brand_id}/remotes/${remote_index}/rules`, 'GET', {}, (rulesBody) => {
                var _a, _b, _c, _d, _e, _f;
                if (!rulesBody.success) {
                    this.log.error(`${this.accessory.displayName}: failed to fetch AC IR rules: ${rulesBody.msg}. AC commands will use cloud API.`);
                    return;
                }
                // AC rules return full-state rows: { power, mode, temp, wind, key: base64IRCode }
                const rows = Array.isArray(rulesBody.result)
                    ? rulesBody.result
                    : ((_b = (_a = rulesBody.result) === null || _a === void 0 ? void 0 : _a.list) !== null && _b !== void 0 ? _b : []);
                let count = 0;
                for (const rule of rows) {
                    const r = rule;
                    const code = r['key'];
                    if (code && typeof code === 'string') {
                        ACCodeCache_1.ACCodeCache.setACState(this.parentId, remoteId, String((_c = r['power']) !== null && _c !== void 0 ? _c : ''), String((_d = r['mode']) !== null && _d !== void 0 ? _d : ''), String((_e = r['temp']) !== null && _e !== void 0 ? _e : ''), String((_f = r['wind']) !== null && _f !== void 0 ? _f : ''), code);
                        count++;
                    }
                }
                this.log.info(`${this.accessory.displayName}: cached ${count} AC IR codes for local dispatch`);
            });
        });
    }
    getTemperatureRange() {
        if (!this.configuration.tuyaAPIClientId)
            return;
        APIInvocationHelper_1.APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, `${this.configuration.apiHost}/v1.0/iot-03/devices/${this.accessory.context.device.id}/specification`, 'GET', {}, (body) => {
            let temperatureConfig = {
                min: 16,
                max: 26,
                step: 1,
            };
            if (body.success) {
                try {
                    temperatureConfig = JSON.parse(body.result.functions.filter((v) => v.code === 'T')[0].values);
                }
                catch (e) {
                    this.log.error(`Failed to parse AC temperature range due to error ${e}. Using defaults.`);
                }
            }
            else {
                this.log.error(`Failed to get AC temperature range. Using defaults. ${body.msg}`);
            }
            this.service
                .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
                .setProps({
                minValue: temperatureConfig.min,
                maxValue: temperatureConfig.max,
                minStep: temperatureConfig.step,
            });
            this.service
                .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
                .setProps({
                minValue: temperatureConfig.min,
                maxValue: temperatureConfig.max,
                minStep: temperatureConfig.step,
            });
            this.log.debug('Minimum Temperature: ' + temperatureConfig.min);
            this.log.debug('Maximum Temperature: ' + temperatureConfig.max);
        });
    }
    /**
     * Poll AC status. Uses local DP query when localKey is configured,
     * falls back to cloud API otherwise.
     */
    async refreshStatus() {
        var _a;
        if (this.configuration.localKey) {
            try {
                const status = await IRBlasterLocalCommand_1.IRBlasterLocalCommand.queryACStatus(this.configuration, this.log);
                if (status) {
                    this.log.debug(`${this.accessory.displayName} local status: ${JSON.stringify(status)}`);
                    this.acStates.On = status.power === '1';
                    this.acStates.mode =
                        (_a = this.modeCode[status.mode]) !== null && _a !== void 0 ? _a : this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
                    this.acStates.temperature = status.temp;
                    this.acStates.fan = status.wind;
                    this.service.updateCharacteristic(this.platform.Characteristic.Active, this.acStates.On);
                    this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.acStates.mode);
                    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.acStates.temperature);
                    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.acStates.fan);
                }
            }
            catch (err) {
                this.log.error(`${this.accessory.displayName}: local status refresh failed: ${err.message}`);
            }
            setTimeout(() => this.refreshStatus(), 30000);
            return;
        }
        // Cloud fallback
        this.getACStatus(this.parentId, this.accessory.context.device.id, (body) => {
            if (!body.success) {
                this.log.error(`Failed to get AC status due to error ${body.msg}`);
            }
            else {
                this.log.debug(`${this.accessory.displayName} status is ${JSON.stringify(body.result)}`);
                this.acStates.On = body.result.power === '1' ? true : false;
                this.acStates.mode =
                    this.modeCode[body.result.mode] ||
                        this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
                this.acStates.temperature = body.result.temp;
                this.acStates.fan = body.result.wind;
                this.service.updateCharacteristic(this.platform.Characteristic.Active, this.acStates.On);
                this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.acStates.mode);
                this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.acStates.temperature);
                this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.acStates.fan);
            }
            setTimeout(() => this.refreshStatus(), 30000);
        });
    }
    async setOn(value) {
        if (this.acStates.On == value)
            return;
        const command = value ? 1 : 0;
        await this.sendACCommand(this.parentId, this.accessory.context.device.id, 'power', command);
        this.log.info(`${this.accessory.displayName} is now ${command == 0 ? 'Off' : 'On'}`);
        this.acStates.On = value;
    }
    getOn() {
        return this.acStates.On;
    }
    async setHeatingCoolingState(value) {
        const val = value;
        let command = 2;
        if (val == this.platform.Characteristic.TargetHeaterCoolerState.COOL)
            command = 0;
        if (val == this.platform.Characteristic.TargetHeaterCoolerState.HEAT)
            command = 1;
        await this.sendACCommand(this.parentId, this.accessory.context.device.id, 'mode', command);
        this.log.info(`${this.accessory.displayName} mode is ${this.modeList[command]}`);
        this.acStates.mode = val;
    }
    getHeatingCoolingState() {
        return this.acStates.mode;
    }
    getCoolingThresholdTemperatureCharacteristic() {
        return this.acStates.temperature;
    }
    async setCoolingThresholdTemperatureCharacteristic(value) {
        const command = value;
        await this.sendACCommand(this.parentId, this.accessory.context.device.id, 'temp', command);
        this.log.info(`${this.accessory.displayName} temperature is set to ${command} degrees.`);
        this.acStates.temperature = command;
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, command);
    }
    getRotationSpeedCharacteristic() {
        return this.acStates.fan;
    }
    async setRotationSpeedCharacteristic(value) {
        const command = value;
        await this.sendACCommand(this.parentId, this.accessory.context.device.id, 'wind', command);
        this.log.info(`${this.accessory.displayName} Fan is set to ${command == 0 ? 'auto' : command}.`);
        this.acStates.fan = command;
    }
    getCurrentTemperature() {
        return this.acStates.temperature;
    }
    async sendACCommand(deviceId, remoteId, command, value) {
        // Try local dispatch first using full AC state lookup
        if (this.configuration.localKey) {
            // Derive the new full state by applying this command to the current state
            const newState = { ...this.acStates };
            if (command === 'power')
                newState.On = value === 1;
            if (command === 'mode')
                newState.mode = value;
            if (command === 'temp')
                newState.temperature = value;
            if (command === 'wind')
                newState.fan = value;
            const code = ACCodeCache_1.ACCodeCache.getACState(this.parentId, remoteId, newState.On ? '1' : '0', String(newState.mode), String(newState.temperature), String(newState.fan));
            if (code) {
                this.log.debug(`${this.accessory.displayName}: sending AC command ${command}=${value} locally`);
                await IRBlasterLocalCommand_1.IRBlasterLocalCommand.sendRawIRCode(this.configuration, code, this.log);
                return;
            }
            this.log.warn(`${this.accessory.displayName}: no cached IR code for ${command}=${value} (state: power=${newState.On ? 1 : 0} mode=${newState.mode} temp=${newState.temperature} wind=${newState.fan}), falling back to cloud`);
        }
        // Cloud fallback
        const commandObj = { code: command, value: value };
        this.log.debug(JSON.stringify(commandObj));
        await new Promise((resolve) => {
            APIInvocationHelper_1.APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, this.configuration.apiHost +
                `/v2.0/infrareds/${deviceId}/air-conditioners/${remoteId}/command`, 'POST', commandObj, (body) => {
                if (!body.success) {
                    this.log.error(`Failed to send AC command ${command}=${value} via cloud: ${body.msg}`);
                }
                resolve();
            });
        });
    }
    getACStatus(deviceId, remoteId, cb) {
        this.log.debug('Getting AC Status from cloud');
        APIInvocationHelper_1.APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, this.configuration.apiHost +
            `/v2.0/infrareds/${deviceId}/remotes/${remoteId}/ac/status`, 'GET', {}, (body) => {
            cb(body);
        });
    }
}
exports.AirConditionerAccessory = AirConditionerAccessory;
//# sourceMappingURL=AirConditionerAccessory.js.map