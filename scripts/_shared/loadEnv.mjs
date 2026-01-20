/**
 * Shared environment loading utility for Node.js scripts
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export function loadEnv(importMetaUrl) {
  const __filename = fileURLToPath(importMetaUrl);
  const __dirname = dirname(__filename);
  
  // Handle scripts that may be in subdirectories
  let envPath = join(__dirname, '../.env');
  if (__dirname.endsWith('_shared')) {
    envPath = join(__dirname, '../../.env');
  }
  
  const envContent = readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      env[match[1]] = value;
    }
  });
  
  return {
    SUPABASE_URL: env['VITE_SUPABASE_URL'],
    SUPABASE_SERVICE_ROLE_KEY: env['SUPABASE_SERVICE_ROLE_KEY'],
    GEMINI_API_KEY: env['GEMINI_API_KEY'],
    ...env
  };
}
