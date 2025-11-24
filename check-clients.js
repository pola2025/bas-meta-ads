require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkClients() {
  console.log('Checking clients...\n');

  const { data, error } = await supabase
    .from('clients')
    .select('*');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data.length} client(s):\n`);
  data.forEach(client => {
    console.log('Full client object:', JSON.stringify(client, null, 2));
    console.log('---');
  });
}

checkClients();
