import { createClient } from '@supabase/supabase-js';
import type { Env } from '../types';

// Supabase 클라이언트 생성
export function getSupabaseClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

// 주간 데이터 조회
export async function fetchWeeklyData(
  env: Env,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from('daily_aggregates')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) {
    console.error('❌ Supabase Error:', error.message);
    throw new Error(`데이터 조회 실패: ${error.message}`);
  }

  return data || [];
}

// Meta 데이터를 daily_aggregates에 저장 (Upsert)
export async function saveMetaDataToSupabase(
  env: Env,
  data: Array<{
    date: string;
    ad_id: string;
    ad_name: string;
    campaign_id: string;
    campaign_name: string;
    impressions: number;
    clicks: number;
    spend: number;
    leads: number;
  }>
): Promise<{ success: number; failed: number; errors: string[] }> {
  const supabase = getSupabaseClient(env);

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  console.log(`💾 Supabase에 ${data.length}건 저장 시작`);

  for (const row of data) {
    try {
      const { error } = await supabase
        .from('daily_aggregates')
        .upsert(row, {
          onConflict: 'date,ad_id', // 중복 방지 (date + ad_id가 unique key)
        });

      if (error) {
        console.error(`  ❌ 저장 실패: ${row.date} ${row.ad_name}`, error.message);
        failed++;
        errors.push(`${row.date} ${row.ad_name}: ${error.message}`);
      } else {
        success++;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ 예외 발생: ${row.date} ${row.ad_name}`, errorMessage);
      failed++;
      errors.push(`${row.date} ${row.ad_name}: ${errorMessage}`);
    }
  }

  console.log(`✅ 저장 완료: 성공 ${success}건, 실패 ${failed}건`);

  return { success, failed, errors };
}
