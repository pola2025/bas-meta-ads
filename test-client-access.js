require('dotenv').config({ path: './dashboard/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testClientAccess() {
  console.log('Testing client access with slug: bas-k92m7x\n');
  
  const { data, error } = await supabase
    .from('clients')
    .select('id, client_name, slug')
    .eq('slug', 'bas-k92m7x')
    .eq('is_active', true)
    .single();
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Result:', data);
  }
}

testClientAccess();
