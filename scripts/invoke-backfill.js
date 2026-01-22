import fs from 'fs';
import path from 'path';

async function invoke() {
  const envPath = path.resolve(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      env[match[1].trim()] = value;
    }
  });

  const url = `${env.VITE_SUPABASE_URL}/functions/v1/backfill-coordinates`;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`🚀 Invoking backfill-coordinates at ${url}...`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ batchSize: 50 }) // Reduced batch size to avoid timeouts
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ HTTP Error ${response.status}:`, text);
      return;
    }

    const data = await response.json();
    console.log('✅ Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error invoking function:', error.message);
  }
}

invoke();
