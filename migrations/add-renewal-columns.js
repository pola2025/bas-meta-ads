#!/usr/bin/env node
/**
 * 연장관리 시스템 마이그레이션
 *
 * 추가되는 항목:
 * 1. clients 테이블 컬럼:
 *    - service_end_date (DATE) - 서비스 종료일
 *    - contact_phone (VARCHAR) - 연락처
 *    - contact_name (VARCHAR) - 담당자명
 *
 * 2. sms_logs 테이블 (문자 발송 이력)
 *
 * 실행: node migrations/add-renewal-columns.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Supabase 직접 DB 연결
function getPool() {
  // Supabase 프로젝트 연결 문자열 생성
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (projectRef && dbPassword) {
    return new Pool({
      connectionString: `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`,
      ssl: { rejectUnauthorized: false }
    });
  }

  // 대안: SUPABASE_URL에서 추출
  const url = process.env.SUPABASE_URL;
  if (url) {
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match && dbPassword) {
      return new Pool({
        connectionString: `postgresql://postgres.${match[1]}:${dbPassword}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`,
        ssl: { rejectUnauthorized: false }
      });
    }
  }

  throw new Error('DB 연결 정보가 없습니다. SUPABASE_PROJECT_REF 및 SUPABASE_DB_PASSWORD 필요');
}

async function runMigration() {
  console.log('\n━'.repeat(50));
  console.log('🔄 연장관리 시스템 마이그레이션');
  console.log('━'.repeat(50));

  let pool;

  try {
    pool = getPool();
    const client = await pool.connect();

    console.log('\n✅ DB 연결 성공\n');

    // 1. clients 테이블에 컬럼 추가
    console.log('📋 1. clients 테이블 컬럼 추가...');

    // service_end_date 컬럼
    try {
      await client.query(`
        ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS service_end_date DATE
      `);
      console.log('   ✅ service_end_date 컬럼 추가됨');
    } catch (e) {
      if (e.code === '42701') {
        console.log('   ⏭️ service_end_date 컬럼 이미 존재');
      } else {
        throw e;
      }
    }

    // contact_phone 컬럼
    try {
      await client.query(`
        ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20)
      `);
      console.log('   ✅ contact_phone 컬럼 추가됨');
    } catch (e) {
      if (e.code === '42701') {
        console.log('   ⏭️ contact_phone 컬럼 이미 존재');
      } else {
        throw e;
      }
    }

    // contact_name 컬럼
    try {
      await client.query(`
        ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS contact_name VARCHAR(50)
      `);
      console.log('   ✅ contact_name 컬럼 추가됨');
    } catch (e) {
      if (e.code === '42701') {
        console.log('   ⏭️ contact_name 컬럼 이미 존재');
      } else {
        throw e;
      }
    }

    // 2. sms_logs 테이블 생성
    console.log('\n📋 2. sms_logs 테이블 생성...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_logs (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        message_type VARCHAR(20) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        request_id VARCHAR(100),
        error TEXT,
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('   ✅ sms_logs 테이블 생성됨');

    // 인덱스 생성
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sms_logs_client_id ON sms_logs(client_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at DESC)
    `);
    console.log('   ✅ 인덱스 생성됨');

    // 3. 기존 클라이언트에 기본 종료일 설정 (없는 경우)
    console.log('\n📋 3. 기존 클라이언트 기본값 설정...');

    const { data: clients } = await supabase
      .from('clients')
      .select('id, client_name, service_start_date, service_end_date')
      .is('service_end_date', null);

    if (clients && clients.length > 0) {
      for (const c of clients) {
        // 시작일 + 3개월을 종료일로 설정
        const startDate = c.service_start_date ? new Date(c.service_start_date) : new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 3);

        await supabase
          .from('clients')
          .update({ service_end_date: endDate.toISOString().split('T')[0] })
          .eq('id', c.id);

        console.log(`   ✅ ${c.client_name}: ${endDate.toISOString().split('T')[0]}`);
      }
    } else {
      console.log('   ⏭️ 업데이트 대상 없음');
    }

    client.release();

    console.log('\n' + '━'.repeat(50));
    console.log('✅ 마이그레이션 완료!');
    console.log('━'.repeat(50));

    console.log('\n📌 다음 단계:');
    console.log('   1. 연락처 등록: node renewal-manager.js contact --client "고객명" --phone "010-xxx"');
    console.log('   2. 목록 확인: node renewal-manager.js list');
    console.log('');

  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:', error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

runMigration();
