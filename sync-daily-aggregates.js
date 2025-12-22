#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function syncAllClients(startDate, endDate) {
  console.log(`=== daily_aggregates 동기화 (${startDate} ~ ${endDate}) ===\n`);

  // 1. 활성 클라이언트 목록
  const { rows: clients } = await pool.query(
    `SELECT id, client_name FROM clients WHERE is_active = true ORDER BY client_name`
  );

  console.log(`대상 클라이언트: ${clients.length}개\n`);

  for (const client of clients) {
    console.log(`[${client.client_name}]`);

    // 2. raw_data에서 해당 기간 데이터 조회
    const { rows: rawData } = await pool.query(
      `SELECT * FROM raw_data
       WHERE client_id = $1 AND date >= $2 AND date <= $3
       ORDER BY date`,
      [client.id, startDate, endDate]
    );

    if (!rawData || rawData.length === 0) {
      console.log(`  → raw_data 없음, 스킵\n`);
      continue;
    }

    console.log(`  raw_data: ${rawData.length}건`);

    // 3. 날짜+광고별로 집계
    const aggregates = {};

    rawData.forEach(row => {
      const key = `${row.date}_${row.ad_id}`;

      if (!aggregates[key]) {
        aggregates[key] = {
          client_id: client.id,
          date: row.date,
          ad_id: row.ad_id,
          ad_name: row.ad_name,
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          impressions: 0,
          reach: 0,
          clicks: 0,
          leads: 0,
          spend: 0,
          video_views: 0,
          video_p25_watched: 0,
          video_p50_watched: 0,
          video_p75_watched: 0,
          video_p100_watched: 0
        };
      }

      aggregates[key].impressions += row.impressions || 0;
      aggregates[key].reach += row.reach || 0;
      aggregates[key].clicks += row.clicks || 0;
      aggregates[key].leads += row.leads || 0;
      aggregates[key].spend += parseFloat(row.spend) || 0;
      aggregates[key].video_views += row.video_views || 0;
      aggregates[key].video_p25_watched += row.video_p25_watched || 0;
      aggregates[key].video_p50_watched += row.video_p50_watched || 0;
      aggregates[key].video_p75_watched += row.video_p75_watched || 0;
      aggregates[key].video_p100_watched += row.video_p100_watched || 0;
    });

    const records = Object.values(aggregates);

    // 4. 기존 데이터 삭제
    await pool.query(
      `DELETE FROM daily_aggregates
       WHERE client_id = $1 AND date >= $2 AND date <= $3`,
      [client.id, startDate, endDate]
    );

    // 5. 새 데이터 삽입
    for (const record of records) {
      await pool.query(
        `INSERT INTO daily_aggregates
         (client_id, date, ad_id, ad_name, campaign_id, campaign_name,
          impressions, reach, clicks, leads, spend,
          video_views, video_p25_watched, video_p50_watched, video_p75_watched, video_p100_watched)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          record.client_id, record.date, record.ad_id, record.ad_name,
          record.campaign_id, record.campaign_name,
          record.impressions, record.reach, record.clicks, record.leads, record.spend,
          record.video_views, record.video_p25_watched, record.video_p50_watched,
          record.video_p75_watched, record.video_p100_watched
        ]
      );
    }

    console.log(`  → daily_aggregates: ${records.length}건 동기화 완료\n`);
  }

  console.log('=== 동기화 완료 ===');
  await pool.end();
}

// 동적 날짜 계산 (가장 최근 완료된 주: 월~일)
function getWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=일, 1=월, ...

  // 가장 최근 일요일 (이번 주 마지막 날)
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - dayOfWeek);

  // 이번 주 월요일 (일요일 - 6일)
  const thisWeekStart = new Date(lastSunday);
  thisWeekStart.setDate(lastSunday.getDate() - 6);

  const formatDate = (d) => d.toISOString().split('T')[0];

  return {
    startDate: formatDate(thisWeekStart),
    endDate: formatDate(lastSunday)
  };
}

const { startDate, endDate } = getWeekDates();
console.log(`동적 계산된 주간: ${startDate} ~ ${endDate}`);
syncAllClients(startDate, endDate).catch(console.error);
