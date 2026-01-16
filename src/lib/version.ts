/**
 * Application version information
 * Extracted from package.json to avoid exposing full package metadata to client bundle
 */

import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version;
export const APP_NAME = 'LCL';
