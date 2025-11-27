require('dotenv').config();
const { Client } = require('pg');

// Use direct connection (not pooler)
const projectRef = process.env.SUPABASE_PROJECT_REF || 'mpljqcuqrrfwzamfyxnz';
const connectionString = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres`;

console.log(`🔌 Connecting to ${connectionString.replace(/:[^:@]+@/, ':****@')}...`);

const client = new Client({ connectionString });

async function testConnection() {
    try {
        await client.connect();
        console.log('✅ Connected successfully!');
        const res = await client.query('SELECT NOW()');
        console.log('🕒 Server time:', res.rows[0].now);
        await client.end();
    } catch (err) {
        console.error('❌ Connection failed:', err);
    }
}

testConnection();
