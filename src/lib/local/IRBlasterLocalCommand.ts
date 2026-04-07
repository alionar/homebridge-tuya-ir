import { Logger } from 'homebridge';
import { LocalDeviceHelper } from './LocalDeviceHelper';
import { TuyaIRConfiguration } from '../model/TuyaIRConfiguration';

// DP number used by Tuya IR blasters to send an IR code
const IR_SEND_DP = 201;

export interface ACStatus {
  power: string;
  mode: number;
  temp: number;
  wind: number;
}

export class IRBlasterLocalCommand {
  /**
   * Send an IR code (base64-encoded Tuya format) via DP 201.
   */
  static async sendRawIRCode(
    config: TuyaIRConfiguration,
    base64Code: string,
    log: Logger,
  ): Promise<void> {
    const payload = JSON.stringify({
      control: 'send_ir',
      head: '',
      key1: base64Code,
      type: 0,
      delay: 300,
    });
    await LocalDeviceHelper.sendDPs(
      config.irDeviceId,
      config.ip,
      config.localKey,
      config.version,
      { [IR_SEND_DP]: payload },
      log,
    );
  }

  /**
   * Query AC state from the device's data points.
   * Maps DPs to the ACStatus shape using the configured acDPMapping.
   */
  static async queryACStatus(
    config: TuyaIRConfiguration,
    log: Logger,
  ): Promise<ACStatus | null> {
    try {
      const dps = await LocalDeviceHelper.queryDPs(
        config.irDeviceId,
        config.ip,
        config.localKey,
        config.version,
        log,
      );
      const m = config.acDPMapping;
      return {
        power: String(dps[m.power] ?? '0'),
        mode: Number(dps[m.mode] ?? 0),
        temp: Number(dps[m.temp] ?? 16),
        wind: Number(dps[m.wind] ?? 0),
      };
    } catch (err) {
      log.error(`Failed to query AC status locally: ${(err as Error).message}`);
      return null;
    }
  }
}
