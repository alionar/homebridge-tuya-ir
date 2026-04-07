import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TuyaIRPlatform } from '../../platform';
import { BaseAccessory } from './BaseAccessory';
import { APIInvocationHelper } from '../api/APIInvocationHelper';
import { IRBlasterLocalCommand } from '../local/IRBlasterLocalCommand';
import { ACCodeCache } from '../local/ACCodeCache';

/**
 * Air Conditioner Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class AirConditionerAccessory extends BaseAccessory {
  private service: Service;
  private modeList = ['Cool', 'Heat', 'Auto'];
  private modeCode: number[] = [];

  private acStates = {
    On: false,
    temperature: 16,
    fan: 0,
    mode: 0,
  };

  constructor(
    private readonly platform: TuyaIRPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);
    this.modeCode = [];
    this.modeCode.push(
      this.platform.Characteristic.TargetHeaterCoolerState.COOL,
    );
    this.modeCode.push(
      this.platform.Characteristic.TargetHeaterCoolerState.HEAT,
    );
    this.modeCode.push(
      this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
    );

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)
      ?.setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        accessory.context.device.brand || 'Unknown',
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        accessory.context.device.model || 'Unknown',
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        accessory.context.device.id,
      );
    this.service =
      this.accessory.getService(this.platform.Service.HeaterCooler) ||
      this.accessory.addService(this.platform.Service.HeaterCooler);
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name,
    );

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
      .getCharacteristic(
        this.platform.Characteristic.CoolingThresholdTemperature,
      )
      .onGet(this.getCoolingThresholdTemperatureCharacteristic.bind(this))
      .onSet(this.setCoolingThresholdTemperatureCharacteristic.bind(this));

    this.service
      .getCharacteristic(
        this.platform.Characteristic.HeatingThresholdTemperature,
      )
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
    } else {
      this.log.warn(`${this.accessory.displayName}: no localKey configured, AC commands will use cloud API`);
    }

    this.refreshStatus();
    this.getTemperatureRange();
  }

  /**
   * Fetch the full AC IR code library from the cloud once at startup.
   * After this, all runtime commands are dispatched locally via DP 201.
   */
  private prefetchACCodes(): void {
    const remoteId = this.accessory.context.device.id;
    if (ACCodeCache.hasACStates(this.parentId, remoteId)) {
      this.log.debug(`${this.accessory.displayName}: AC codes already cached`);
      return;
    }

    this.log.debug(`${this.accessory.displayName}: fetching AC IR codes from cloud for local dispatch...`);
    APIInvocationHelper.invokeTuyaIrApi(
      this.log,
      this.configuration,
      `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/remotes/${remoteId}/keys`,
      'GET',
      {},
      (keysBody) => {
        if (!keysBody.success) {
          this.log.error(`${this.accessory.displayName}: failed to fetch AC remote keys: ${keysBody.msg}. AC commands will use cloud API.`);
          return;
        }
        const { category_id, brand_id, remote_index } = keysBody.result;
        APIInvocationHelper.invokeTuyaIrApi(
          this.log,
          this.configuration,
          `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/categories/${category_id}/brands/${brand_id}/remotes/${remote_index}/rules`,
          'GET',
          {},
          (rulesBody) => {
            if (!rulesBody.success) {
              this.log.error(`${this.accessory.displayName}: failed to fetch AC IR rules: ${rulesBody.msg}. AC commands will use cloud API.`);
              return;
            }
            // AC rules return rows: { code: base64IRCode, key: "M{mode}_T{temp}_S{fan}" | "M{mode}_S{fan}" | "PowerOff" | "PowerOn", key_id: 0 }
            const rows: unknown[] = Array.isArray(rulesBody.result)
              ? rulesBody.result
              : (rulesBody.result?.list ?? []);
            let count = 0;
            for (const rule of rows) {
              const r = rule as Record<string, unknown>;
              const irCode = r['code'];       // actual base64 IR code
              const keyStr = r['key'];         // "M0_T16_S0", "M2_S0", "PowerOff", etc.
              if (!irCode || typeof irCode !== 'string' || !keyStr || typeof keyStr !== 'string') continue;

              if (keyStr === 'PowerOff') {
                ACCodeCache.setACState(this.parentId, remoteId, '0', '0', '0', '0', irCode);
                count++;
              } else {
                // "M{tuyaMode}_T{temp}_S{fan}" — full-state entry
                const fullMatch = keyStr.match(/^M(\d+)_T(\d+)_S(\d+)$/);
                if (fullMatch) {
                  const [, tuyaMode, temp, fan] = fullMatch;
                  ACCodeCache.setACState(this.parentId, remoteId, '1', tuyaMode, temp, fan, irCode);
                  count++;
                  continue;
                }
                // "M{tuyaMode}_S{fan}" — mode with no temperature (e.g. auto/fan-only)
                const noTempMatch = keyStr.match(/^M(\d+)_S(\d+)$/);
                if (noTempMatch) {
                  const [, tuyaMode, fan] = noTempMatch;
                  ACCodeCache.setACState(this.parentId, remoteId, '1', tuyaMode, 'none', fan, irCode);
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
                const siblingId = ACCodeCache.findPopulatedACRemote(this.parentId, remoteId);
                if (siblingId) {
                  const copied = ACCodeCache.copyACCodes(siblingId, remoteId, this.parentId);
                  this.log.info(`${this.accessory.displayName}: copied ${copied} AC IR codes from sibling remote for local dispatch`);
                } else {
                  this.log.warn(`${this.accessory.displayName}: no sibling AC remote found with cached codes, AC commands will use cloud API`);
                }
              }, 15000);
            }
          },
        );
      },
    );
  }

  getTemperatureRange() {
    if (!this.configuration.tuyaAPIClientId) return;
    APIInvocationHelper.invokeTuyaIrApi(
      this.log,
      this.configuration,
      `${this.configuration.apiHost}/v1.0/iot-03/devices/${this.accessory.context.device.id}/specification`,
      'GET',
      {},
      (body) => {
        let temperatureConfig = {
          min: 16,
          max: 26,
          step: 1,
        };
        if (body.success) {
          try {
            temperatureConfig = JSON.parse(
              body.result.functions.filter((v) => v.code === 'T')[0].values,
            );
          } catch (e) {
            this.log.error(
              `Failed to parse AC temperature range due to error ${e}. Using defaults.`,
            );
          }
        } else {
          this.log.error(
            `Failed to get AC temperature range. Using defaults. ${body.msg}`,
          );
        }
        this.service
          .getCharacteristic(
            this.platform.Characteristic.CoolingThresholdTemperature,
          )
          .setProps({
            minValue: temperatureConfig.min,
            maxValue: temperatureConfig.max,
            minStep: temperatureConfig.step,
          });
        this.service
          .getCharacteristic(
            this.platform.Characteristic.HeatingThresholdTemperature,
          )
          .setProps({
            minValue: temperatureConfig.min,
            maxValue: temperatureConfig.max,
            minStep: temperatureConfig.step,
          });
        this.log.debug('Minimum Temperature: ' + temperatureConfig.min);
        this.log.debug('Maximum Temperature: ' + temperatureConfig.max);
      },
    );
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
    this.getACStatus(
      this.parentId,
      this.accessory.context.device.id,
      (body) => {
        if (!body.success) {
          this.log.error(`Failed to get AC status due to error ${body.msg}`);
        } else {
          this.log.debug(
            `${this.accessory.displayName} status is ${JSON.stringify(body.result)}`,
          );
          this.acStates.On = body.result.power === '1' ? true : false;
          this.acStates.mode =
            this.modeCode[body.result.mode as number] ||
            this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
          this.acStates.temperature = body.result.temp as number;
          this.acStates.fan = body.result.wind as number;
          this.service.updateCharacteristic(this.platform.Characteristic.Active, this.acStates.On);
          this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.acStates.mode);
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.acStates.temperature);
          this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.acStates.fan);
        }
        setTimeout(() => this.refreshStatus(), 30000);
      },
    );
  }

  async setOn(value: CharacteristicValue) {
    if (this.acStates.On == (value as boolean)) return;
    const command = (value as boolean) ? 1 : 0;
    await this.sendACCommand(
      this.parentId,
      this.accessory.context.device.id,
      'power',
      command,
    );
    this.log.info(`${this.accessory.displayName} is now ${command == 0 ? 'Off' : 'On'}`);
    this.acStates.On = value as boolean;
  }

  getOn(): CharacteristicValue {
    return this.acStates.On;
  }

  async setHeatingCoolingState(value: CharacteristicValue) {
    const val = value as number;
    let command = 2;
    if (val == this.platform.Characteristic.TargetHeaterCoolerState.COOL)
      command = 0;
    if (val == this.platform.Characteristic.TargetHeaterCoolerState.HEAT)
      command = 1;

    await this.sendACCommand(
      this.parentId,
      this.accessory.context.device.id,
      'mode',
      command,
    );
    this.log.info(`${this.accessory.displayName} mode is ${this.modeList[command]}`);
    this.acStates.mode = val;
  }

  getHeatingCoolingState(): CharacteristicValue {
    return this.acStates.mode;
  }

  getCoolingThresholdTemperatureCharacteristic(): CharacteristicValue {
    return this.acStates.temperature;
  }

  async setCoolingThresholdTemperatureCharacteristic(value: CharacteristicValue) {
    const command = value as number;
    await this.sendACCommand(
      this.parentId,
      this.accessory.context.device.id,
      'temp',
      command,
    );
    this.log.info(`${this.accessory.displayName} temperature is set to ${command} degrees.`);
    this.acStates.temperature = command;
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, command);
  }

  getRotationSpeedCharacteristic(): CharacteristicValue {
    return this.acStates.fan;
  }

  async setRotationSpeedCharacteristic(value: CharacteristicValue) {
    const command = value as number;
    await this.sendACCommand(
      this.parentId,
      this.accessory.context.device.id,
      'wind',
      command,
    );
    this.log.info(`${this.accessory.displayName} Fan is set to ${command == 0 ? 'auto' : command}.`);
    this.acStates.fan = command;
  }

  getCurrentTemperature(): CharacteristicValue {
    return this.acStates.temperature;
  }

  async sendACCommand(
    deviceId: string,
    remoteId: string,
    command: string,
    value: string | number,
  ): Promise<void> {
    // Try local dispatch first using full AC state lookup
    if (this.configuration.localKey) {
      // Derive the new full state by applying this command to the current state
      const newState = { ...this.acStates };
      if (command === 'power') newState.On = value === 1;
      if (command === 'mode') newState.mode = value as number;
      if (command === 'temp') newState.temperature = value as number;
      if (command === 'wind') newState.fan = value as number;

      // For non-power commands assume the AC is on — IR codes encode the full
      // state and these settings are only meaningful while running.
      const powerForLookup = command === 'power' ? (newState.On ? '1' : '0') : '1';

      // HomeKit mode: AUTO=0, HEAT=1, COOL=2 → Tuya: M0=cool, M1=heat, M2=auto
      const HOMEKIT_TO_TUYA_MODE = [2, 1, 0];
      const tuyaMode = HOMEKIT_TO_TUYA_MODE[newState.mode] ?? 2;

      const code = ACCodeCache.getACState(
        this.parentId, remoteId,
        powerForLookup,
        String(tuyaMode),
        String(newState.temperature),
        String(newState.fan),
      );
      if (code) {
        this.log.debug(`${this.accessory.displayName}: sending AC command ${command}=${value} locally`);
        await IRBlasterLocalCommand.sendRawIRCode(this.configuration, code, this.log);
        return;
      }
      this.log.warn(`${this.accessory.displayName}: no cached IR code for ${command}=${value} (lookup: power=${powerForLookup} tuyaMode=${tuyaMode} temp=${newState.temperature} fan=${newState.fan}), falling back to cloud`);
    }

    // Cloud fallback
    const commandObj = { code: command, value: value };
    this.log.debug(JSON.stringify(commandObj));
    await new Promise<void>((resolve) => {
      APIInvocationHelper.invokeTuyaIrApi(
        this.log,
        this.configuration,
        this.configuration.apiHost +
          `/v2.0/infrareds/${deviceId}/air-conditioners/${remoteId}/command`,
        'POST',
        commandObj,
        (body) => {
          if (!body.success) {
            this.log.error(
              `Failed to send AC command ${command}=${value} via cloud: ${body.msg}`,
            );
          }
          resolve();
        },
      );
    });
  }

  getACStatus(deviceId: string, remoteId: string, cb) {
    this.log.debug('Getting AC Status from cloud');
    APIInvocationHelper.invokeTuyaIrApi(
      this.log,
      this.configuration,
      this.configuration.apiHost +
        `/v2.0/infrareds/${deviceId}/remotes/${remoteId}/ac/status`,
      'GET',
      {},
      (body) => {
        cb(body);
      },
    );
  }
}
