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
                var _a, _b;
                if (!rulesBody.success) {
                    this.log.error(`${this.accessory.displayName}: failed to fetch AC IR rules: ${rulesBody.msg}. AC commands will use cloud API.`);
                    return;
                }
                // AC rules return rows: { code: base64IRCode, key: "M{mode}_T{temp}_S{fan}" | "M{mode}_S{fan}" | "PowerOff" | "PowerOn", key_id: 0 }
                const rows = Array.isArray(rulesBody.result)
                    ? rulesBody.result
                    : ((_b = (_a = rulesBody.result) === null || _a === void 0 ? void 0 : _a.list) !== null && _b !== void 0 ? _b : []);
                let count = 0;
                for (const rule of rows) {
                    const r = rule;
                    const irCode = r['code']; // actual base64 IR code
                    const keyStr = r['key']; // "M0_T16_S0", "M2_S0", "PowerOff", etc.
                    if (!irCode || typeof irCode !== 'string' || !keyStr || typeof keyStr !== 'string')
                        continue;
                    if (keyStr === 'PowerOff') {
                        ACCodeCache_1.ACCodeCache.setACState(this.parentId, remoteId, '0', '0', '0', '0', irCode);
                        count++;
                    }
                    else {
                        // "M{tuyaMode}_T{temp}_S{fan}" — full-state entry
                        const fullMatch = keyStr.match(/^M(\d+)_T(\d+)_S(\d+)$/);
                        if (fullMatch) {
                            const [, tuyaMode, temp, fan] = fullMatch;
                            ACCodeCache_1.ACCodeCache.setACState(this.parentId, remoteId, '1', tuyaMode, temp, fan, irCode);
                            count++;
                            continue;
                        }
                        // "M{tuyaMode}_S{fan}" — mode with no temperature (e.g. auto/fan-only)
                        const noTempMatch = keyStr.match(/^M(\d+)_S(\d+)$/);
                        if (noTempMatch) {
                            const [, tuyaMode, fan] = noTempMatch;
                            ACCodeCache_1.ACCodeCache.setACState(this.parentId, remoteId, '1', tuyaMode, 'none', fan, irCode);
                            count++;
                        }
                        // Skip PowerOn and unrecognised keys
                    }
                }
                this.log.info(`${this.accessory.displayName}: cached ${count} AC IR codes for local dispatch`);
                if (count === 0) {
                    // This remote has no IR codes in Tuya's DB (e.g. a different registration of the same model).
                    // Schedule a retry to copy codes from a sibling AC remote on the same IR blaster.
                    this.log.warn(`${this.accessory.displayName}: rules returned no codes — will attempt to copy from sibling AC in 15s`);
                    setTimeout(() => {
                        const siblingId = ACCodeCache_1.ACCodeCache.findPopulatedACRemote(this.parentId, remoteId);
                        if (siblingId) {
                            const copied = ACCodeCache_1.ACCodeCache.copyACCodes(siblingId, remoteId, this.parentId);
                            this.log.info(`${this.accessory.displayName}: copied ${copied} AC IR codes from sibling remote for local dispatch`);
                        }
                        else {
                            this.log.warn(`${this.accessory.displayName}: no sibling AC remote found with cached codes, AC commands will use cloud API`);
                        }
                    }, 15000);
                }
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
        if (this.configuration.localKey) {
            // IR blasters are one-way — they cannot report the AC's state.
            // Push the current in-memory state to HomeKit so the UI stays consistent.
            this.service.updateCharacteristic(this.platform.Characteristic.Active, this.acStates.On);
            this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.acStates.mode);
            this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.acStates.temperature);
            this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.acStates.fan);
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
        var _a;
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
            // HomeKit mode: AUTO=0, HEAT=1, COOL=2 → Tuya: M0=cool, M1=heat, M2=auto
            const HOMEKIT_TO_TUYA_MODE = [2, 1, 0];
            const tuyaMode = (_a = HOMEKIT_TO_TUYA_MODE[newState.mode]) !== null && _a !== void 0 ? _a : 2;
            const code = ACCodeCache_1.ACCodeCache.getACState(this.parentId, remoteId, newState.On ? '1' : '0', String(tuyaMode), String(newState.temperature), String(newState.fan));
            if (code) {
                this.log.debug(`${this.accessory.displayName}: sending AC command ${command}=${value} locally`);
                await IRBlasterLocalCommand_1.IRBlasterLocalCommand.sendRawIRCode(this.configuration, code, this.log);
                return;
            }
            this.log.warn(`${this.accessory.displayName}: no cached IR code for ${command}=${value} (state: power=${newState.On ? 1 : 0} tuyaMode=${tuyaMode} temp=${newState.temperature} fan=${newState.fan}), falling back to cloud`);
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