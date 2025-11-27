#!/usr/bin/env node
/**
 * 통합 상태 확인 CLI
 *
 * 사용법:
 *   node status.js                      # 전체 클라이언트 요약
 *   node status.js --client "ABC마케팅"  # 특정 클라이언트 상세
 *   node status.js --help               # 도움말
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const logger = require('./lib/logger');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 인자 파싱
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { client: null, help: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--client' || args[i] === '-c') {
      options.client = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      options.help = true;
    } else if (!args[i].startsWith('-')) {
      options.client = args[i];
    }
  }

  return options;
}

// 도움말
function showHelp() {
  console.log(`
📊 BAS Meta Ads - 상태 확인 CLI

사용법:
  node status.js                      전체 클라이언트 요약
  node status.js "ABC마케팅"           특정 클라이언트 상세
  node status.js --client "ABC마케팅"  특정 클라이언트 상세
  node status.js --help               도움말

옵션:
  --client, -c  클라이언트명 지정
  --help, -h    도움말 표시
`);
}

// 전체 클라이언트 요약
async function showAllStatus() {
  console.log('━'.repeat(70));
  console.log('📊 BAS Meta Ads - 전체 상태');
  console.log('━'.repeat(70));

  // 1. 클라이언트 목록
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, client_name, is_active, telegram_chat_id, service_start_date, service_end_date')
    .order('client_name');

  if (clientError) {
    logger.fail('STATUS', `클라이언트 조회 실패: ${clientError.message}`);
    return;
  }

  console.log(`\n👥 클라이언트: ${clients.length}개 (활성: ${clients.filter(c => c.is_active).length}개)\n`);

  // 2. 각 클라이언트별 데이터 현황
  console.log('┌' + '─'.repeat(68) + '┐');
  console.log('│ ' + '클라이언트'.padEnd(20) + '상태'.padEnd(8) + '최신 데이터'.padEnd(15) + '데이터 수'.padEnd(12) + '텔레그램'.padEnd(10) + ' │');
  console.log('├' + '─'.repeat(68) + '┤');

  for (const client of clients) {
    // 최신 데이터 날짜 조회
    const { data: latestData } = await supabase
      .from('raw_data')
      .select('date')
      .eq('client_id', client.id)
      .order('date', { ascending: false })
      .limit(1);

    // 데이터 건수 조회
    const { count } = await supabase
      .from('raw_data')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id);

    const status = client.is_active ? '✅ 활성' : '⏸️ 비활성';
    const latestDate = latestData?.[0]?.date || '-';
    const dataCount = count || 0;
    const telegram = client.telegram_chat_id ? '✅' : '❌';

    console.log('│ ' +
      client.client_name.padEnd(18) +
      status.padEnd(10) +
      latestDate.padEnd(13) +
      `${dataCount}건`.padEnd(12) +
      telegram.padEnd(8) +
      ' │'
    );
  }

  console.log('└' + '─'.repeat(68) + '┘');

  // 3. 최근 7일 데이터 요약
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString().split('T')[0];

  const { data: recentData } = await supabase
    .from('raw_data')
    .select('date, impressions, clicks, leads, spend')
    .gte('date', since);

  if (recentData && recentData.length > 0) {
    const totals = recentData.reduce((acc, row) => ({
      impressions: acc.impressions + (row.impressions || 0),
      clicks: acc.clicks + (row.clicks || 0),
      leads: acc.leads + (row.leads || 0),
      spend: acc.spend + (parseFloat(row.spend) || 0)
    }), { impressions: 0, clicks: 0, leads: 0, spend: 0 });

    console.log(`\n📈 최근 7일 전체 합계 (${since} ~ 오늘)`);
    console.log(`   노출: ${totals.impressions.toLocaleString()}회`);
    console.log(`   클릭: ${totals.clicks.toLocaleString()}회`);
    console.log(`   리드: ${totals.leads.toLocaleString()}건`);
    console.log(`   지출: ${totals.spend.toLocaleString()}원`);
  }

  console.log('\n' + '━'.repeat(70));
  logger.info('STATUS', `전체 상태 조회 완료 (${clients.length}개 클라이언트)`);
}

// 특정 클라이언트 상세
async function showClientStatus(clientName) {
  console.log('━'.repeat(70));
  console.log(`📊 클라이언트 상세: ${clientName}`);
  console.log('━'.repeat(70));

  // 1. 클라이언트 정보 조회
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .ilike('client_name', `%${clientName}%`)
    .single();

  if (clientError || !client) {
    logger.fail('STATUS', `클라이언트 "${clientName}" 찾을 수 없음`);
    console.log(`\n❌ "${clientName}" 클라이언트를 찾을 수 없습니다.`);
    console.log('\n등록된 클라이언트 목록:');

    const { data: allClients } = await supabase
      .from('clients')
      .select('client_name, is_active');

    allClients?.forEach(c => {
      console.log(`  - ${c.client_name} ${c.is_active ? '(활성)' : '(비활성)'}`);
    });
    return;
  }

  // 2. 기본 정보
  console.log('\n📋 기본 정보');
  console.log(`   ID: ${client.id}`);
  console.log(`   이름: ${client.client_name}`);
  console.log(`   상태: ${client.is_active ? '✅ 활성' : '⏸️ 비활성'}`);
  console.log(`   광고계정: ${client.meta_ad_account_id || '❌ 미설정'}`);
  console.log(`   텔레그램: ${client.telegram_chat_id || '❌ 미설정'}`);
  console.log(`   토큰: ${client.encrypted_access_token ? '✅ 설정됨 (암호화)' : '❌ 미설정'}`);

  if (client.service_start_date) {
    console.log(`   서비스 기간: ${client.service_start_date} ~ ${client.service_end_date || '진행중'}`);
  }

  // 3. 데이터 현황
  const { count: totalCount } = await supabase
    .from('raw_data')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', client.id);

  const { data: dateRange } = await supabase
    .from('raw_data')
    .select('date')
    .eq('client_id', client.id)
    .order('date', { ascending: true })
    .limit(1);

  const { data: latestDate } = await supabase
    .from('raw_data')
    .select('date')
    .eq('client_id', client.id)
    .order('date', { ascending: false })
    .limit(1);

  console.log('\n📊 데이터 현황');
  console.log(`   총 데이터: ${totalCount?.toLocaleString() || 0}건`);
  console.log(`   데이터 범위: ${dateRange?.[0]?.date || '-'} ~ ${latestDate?.[0]?.date || '-'}`);

  // 4. 최근 7일 성과
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString().split('T')[0];

  const { data: recentData } = await supabase
    .from('raw_data')
    .select('date, impressions, clicks, leads, spend')
    .eq('client_id', client.id)
    .gte('date', since)
    .order('date', { ascending: false });

  if (recentData && recentData.length > 0) {
    const totals = recentData.reduce((acc, row) => ({
      impressions: acc.impressions + (row.impressions || 0),
      clicks: acc.clicks + (row.clicks || 0),
      leads: acc.leads + (row.leads || 0),
      spend: acc.spend + (parseFloat(row.spend) || 0)
    }), { impressions: 0, clicks: 0, leads: 0, spend: 0 });

    console.log(`\n📈 최근 7일 성과 (${since} ~)`);
    console.log(`   노출: ${totals.impressions.toLocaleString()}회`);
    console.log(`   클릭: ${totals.clicks.toLocaleString()}회`);
    console.log(`   리드: ${totals.leads.toLocaleString()}건`);
    console.log(`   지출: ${totals.spend.toLocaleString()}원`);

    if (totals.clicks > 0) {
      const ctr = (totals.clicks / totals.impressions * 100).toFixed(2);
      const cpl = totals.leads > 0 ? (totals.spend / totals.leads).toFixed(0) : '-';
      console.log(`   CTR: ${ctr}%`);
      console.log(`   CPL: ${cpl}원`);
    }

    // 일별 데이터
    console.log('\n📅 일별 데이터:');
    const byDate = {};
    recentData.forEach(row => {
      if (!byDate[row.date]) byDate[row.date] = { leads: 0, spend: 0 };
      byDate[row.date].leads += row.leads || 0;
      byDate[row.date].spend += parseFloat(row.spend) || 0;
    });

    Object.keys(byDate).sort().reverse().forEach(date => {
      const d = byDate[date];
      console.log(`   ${date}: 리드 ${d.leads}건, ${d.spend.toLocaleString()}원`);
    });
  } else {
    console.log('\n⚠️ 최근 7일 데이터 없음');
  }

  // 5. 최근 리포트
  const { data: reports } = await supabase
    .from('telegram_reports')
    .select('report_type, week_start, week_end, sent_at')
    .eq('client_id', client.id)
    .order('sent_at', { ascending: false })
    .limit(3);

  if (reports && reports.length > 0) {
    console.log('\n📨 최근 리포트:');
    reports.forEach(r => {
      const sentDate = new Date(r.sent_at).toLocaleString('ko-KR');
      console.log(`   ${r.report_type}: ${r.week_start} ~ ${r.week_end} (${sentDate})`);
    });
  }

  console.log('\n' + '━'.repeat(70));
  logger.info('STATUS', `${clientName} 상세 조회 완료`);
}

// 메인
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  try {
    if (options.client) {
      await showClientStatus(options.client);
    } else {
      await showAllStatus();
    }
  } catch (error) {
    logger.fail('STATUS', error.message);
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

main();
