import { API } from 'homebridge';

import { TuyaIRPlatform } from './platform';
const PLATFORM_NAME = 'TuyaIRLocal';
/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, TuyaIRPlatform);
};
