#!/usr/bin/env node
/**
 * OAuth 하이브리드 인증 시스템 마이그레이션
 *
 * 추가되는 항목:
 * 1. clients 테이블 컬럼:
 *    - auth_type (VARCHAR) - 'manual' | 'oauth'
 *    - status (VARCHAR) - 'pending' | 'active' | 'suspended' | 'expired'
 *    - approved_at (TIMESTAMP) - 승인 일시
 *    - approved_by (VARCHAR) - 승인자
 *    - contract_start_date (DATE) - 계약 시작일
 *    - contract_end_date (DATE) - 계약 종료일
 *    - suspended_at (TIMESTAMP) - 중지 일시
 *    - suspension_reason (TEXT) - 중지 사유
 *    - meta_user_id (VARCHAR) - OAuth 사용자 ID
 *    - meta_user_name (VARCHAR) - OAuth 사용자명
 *    - oauth_registered_at (TIMESTAMP) - OAuth 등록 일시
 *
 * 2. oauth_sessions 테이블 (CSRF 토큰 관리)
 *
 * 핵심 원칙:
 * - 기존 클라이언트는 auth_type='manual', status='active'로 설정
 * - 신규 OAuth 클라이언트만 auth_type='oauth'로 등록
 *
 * 실행: node migrations/add-oauth-hybrid-columns.js
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
  // DATABASE_URL 환경변수 우선 사용
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }

  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (projectRef && dbPassword) {
    return new Pool({
      connectionString: `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`,
      ssl: { rejectUnauthorized: false }
    });
  }

  throw new Error('DB 연결 정보가 없습니다. DATABASE_URL 또는 SUPABASE_PROJECT_REF 필요');
}

async function runMigration() {
  console.log('\n' + '━'.repeat(60));
  console.log('🔐 OAuth 하이브리드 인증 시스템 마이그레이션');
  console.log('━'.repeat(60));

  let pool;

  try {
    pool = getPool();
    const client = await pool.connect();

    console.log('\n✅ DB 연결 성공\n');

    // ================================================================
    // 1. clients 테이블에 OAuth 관련 컬럼 추가
    // ================================================================
    console.log('📋 1. clients 테이블 OAuth 컬럼 추가...');

    const columnsToAdd = [
      { name: 'auth_type', type: "VARCHAR(20) DEFAULT 'manual'" },
      { name: 'status', type: "VARCHAR(20) DEFAULT 'active'" },
      { name: 'approved_at', type: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'approved_by', type: 'VARCHAR(100)' },
      { name: 'contract_start_date', type: 'DATE' },
      { name: 'contract_end_date', type: 'DATE' },
      { name: 'suspended_at', type: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'suspension_reason', type: 'TEXT' },
      { name: 'meta_user_id', type: 'VARCHAR(50)' },
      { name: 'meta_user_name', type: 'VARCHAR(100)' },
      { name: 'oauth_registered_at', type: 'TIMESTAMP WITH TIME ZONE' }
    ];

    for (const col of columnsToAdd) {
      try {
        await client.query(`
          ALTER TABLE clients
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
        console.log(`   ✅ ${col.name} 컬럼 추가됨`);
      } catch (e) {
        if (e.code === '42701') {
          console.log(`   ⏭️ ${col.name} 컬럼 이미 존재`);
        } else {
          throw e;
        }
      }
    }

    // ================================================================
    // 2. 인덱스 생성
    // ================================================================
    console.log('\n📋 2. 인덱스 생성...');

    const indexes = [
      { name: 'idx_clients_auth_type', column: 'auth_type' },
      { name: 'idx_clients_status', column: 'status' },
      { name: 'idx_clients_meta_user_id', column: 'meta_user_id' }
    ];

    for (const idx of indexes) {
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS ${idx.name} ON clients(${idx.column})
        `);
        console.log(`   ✅ ${idx.name} 인덱스 생성됨`);
      } catch (e) {
        console.log(`   ⏭️ ${idx.name} 인덱스 이미 존재`);
      }
    }

    // ================================================================
    // 3. oauth_sessions 테이블 생성 (CSRF 토큰 관리)
    // ================================================================
    console.log('\n📋 3. oauth_sessions 테이블 생성...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS oauth_sessions (
        id SERIAL PRIMARY KEY,
        state VARCHAR(64) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        metadata JSONB
      )
    `);
    console.log('   ✅ oauth_sessions 테이블 생성됨');

    // CSRF 토큰 자동 만료를 위한 인덱스
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires_at ON oauth_sessions(expires_at)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON oauth_sessions(state)
    `);
    console.log('   ✅ oauth_sessions 인덱스 생성됨');

    // ================================================================
    // 4. 기존 클라이언트 기본값 설정 (가장 중요!) ⭐
    // ================================================================
    console.log('\n📋 4. 기존 클라이언트 기본값 설정...');
    console.log('   ⚠️  핵심: 기존 클라이언트는 auth_type=\'manual\', status=\'active\'로 설정');

    // auth_type이 NULL인 기존 클라이언트를 'manual'로 설정
    const updateAuthType = await client.query(`
      UPDATE clients
      SET auth_type = 'manual'
      WHERE auth_type IS NULL
      RETURNING id, client_name
    `);

    if (updateAuthType.rowCount > 0) {
      console.log(`   ✅ ${updateAuthType.rowCount}개 클라이언트의 auth_type을 'manual'로 설정:`);
      updateAuthType.rows.forEach(row => {
        console.log(`      - ${row.client_name}`);
      });
    } else {
      console.log('   ⏭️ auth_type 업데이트 대상 없음');
    }

    // status가 NULL인 기존 클라이언트를 'active'로 설정
    const updateStatus = await client.query(`
      UPDATE clients
      SET status = 'active'
      WHERE status IS NULL
      RETURNING id, client_name
    `);

    if (updateStatus.rowCount > 0) {
      console.log(`   ✅ ${updateStatus.rowCount}개 클라이언트의 status를 'active'로 설정:`);
      updateStatus.rows.forEach(row => {
        console.log(`      - ${row.client_name}`);
      });
    } else {
      console.log('   ⏭️ status 업데이트 대상 없음');
    }

    // ================================================================
    // 5. 마이그레이션 검증
    // ================================================================
    console.log('\n📋 5. 마이그레이션 검증...');

    const { data: verifyClients, error: verifyError } = await supabase
      .from('clients')
      .select('id, client_name, auth_type, status, is_active')
      .order('client_name');

    if (verifyError) {
      console.error('   ❌ 검증 실패:', verifyError.message);
    } else {
      console.log('\n   📊 클라이언트 상태 요약:');
      console.log('   ┌──────────────────────────────────────────────────────┐');
      console.log('   │ 클라이언트명          │ auth_type │ status    │ is_active │');
      console.log('   ├──────────────────────────────────────────────────────┤');

      verifyClients.forEach(c => {
        const name = (c.client_name || '').padEnd(18).slice(0, 18);
        const auth = (c.auth_type || 'null').padEnd(9);
        const status = (c.status || 'null').padEnd(9);
        const active = c.is_active ? '✓' : '✗';
        console.log(`   │ ${name} │ ${auth} │ ${status} │ ${active.padEnd(9)} │`);
      });

      console.log('   └──────────────────────────────────────────────────────┘');

      // 통계
      const manual = verifyClients.filter(c => c.auth_type === 'manual').length;
      const oauth = verifyClients.filter(c => c.auth_type === 'oauth').length;
      const active = verifyClients.filter(c => c.status === 'active').length;
      const pending = verifyClients.filter(c => c.status === 'pending').length;

      console.log(`\n   📈 통계:`);
      console.log(`      - auth_type='manual': ${manual}개`);
      console.log(`      - auth_type='oauth': ${oauth}개`);
      console.log(`      - status='active': ${active}개`);
      console.log(`      - status='pending': ${pending}개`);
    }

    client.release();

    console.log('\n' + '━'.repeat(60));
    console.log('✅ OAuth 하이브리드 마이그레이션 완료!');
    console.log('━'.repeat(60));

    console.log('\n📌 다음 단계:');
    console.log('   1. 환경변수 추가: NEXT_PUBLIC_META_REDIRECT_URI');
    console.log('   2. Meta App 설정에서 Redirect URI 등록');
    console.log('   3. dashboard에서 OAuth API 테스트');
    console.log('');

  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// 롤백 스크립트 (필요시)
async function rollback() {
  console.log('\n⚠️  롤백 스크립트 (OAuth 클라이언트만 비활성화)');

  const { data, error } = await supabase
    .from('clients')
    .update({ is_active: false })
    .eq('auth_type', 'oauth')
    .select('id, client_name');

  if (error) {
    console.error('롤백 실패:', error.message);
  } else {
    console.log(`✅ ${data.length}개 OAuth 클라이언트 비활성화 완료`);
    data.forEach(c => console.log(`   - ${c.client_name}`));
  }
}

// 명령줄 인자 처리
const args = process.argv.slice(2);
if (args.includes('--rollback')) {
  rollback();
} else {
  runMigration();
}
