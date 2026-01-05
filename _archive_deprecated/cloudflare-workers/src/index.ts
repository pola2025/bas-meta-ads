import type { Env, ReportData } from './types';
import { getWeekDates } from './lib/dates';
import { fetchWeeklyData, saveMetaDataToSupabase } from './lib/supabase';
import { collectMetaData } from './lib/meta-api';
import { calculateWeeklySummary, getAdPerformance, getCampaignPerformance } from './lib/analytics';
import { generateReportMessages, sendTelegramMessage, sendZeroDataAlert, sendErrorAlert } from './lib/telegram';
import { generateAIInsights } from './lib/gemini';

export default {
  // Cron Trigger - 매주 월요일 00:00 UTC (09:00 KST)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('🚀 주간 리포트 생성 시작');
    console.log('📅 Cron triggered at:', new Date().toISOString());

    try {
      // 1. 날짜 계산
      const dates = getWeekDates();
      console.log('📅 이번 주:', dates.thisWeekStart, '~', dates.thisWeekEnd);
      console.log('📅 지난 주:', dates.lastWeekStart, '~', dates.lastWeekEnd);

      // 2. Meta API에서 데이터 수집
      console.log('\n🔄 Meta API에서 데이터 수집 중...');
      const metaData = await collectMetaData(env, dates.thisWeekStart, dates.thisWeekEnd);

      if (metaData.length === 0) {
        console.error('⚠️ Meta API에서 데이터를 가져올 수 없습니다!');
        await sendErrorAlert(env, 'Meta API 데이터 수집 실패: 데이터 없음');
        return;
      }

      console.log(`✅ Meta API 수집 완료: ${metaData.length}건`);

      // 3. Supabase에 데이터 저장
      console.log('\n💾 Supabase에 저장 중...');
      const saveResult = await saveMetaDataToSupabase(env, metaData);
      console.log(`✅ 저장 완료: 성공 ${saveResult.success}건, 실패 ${saveResult.failed}건`);

      if (saveResult.failed > 0) {
        console.warn(`⚠️ 저장 실패 항목: ${saveResult.errors.join(', ')}`);
      }

      // 4. Supabase에서 데이터 조회 (리포트 생성용)
      console.log('\n🔍 Supabase에서 데이터 조회 중...');
      const [thisWeekData, lastWeekData] = await Promise.all([
        fetchWeeklyData(env, dates.thisWeekStart, dates.thisWeekEnd),
        fetchWeeklyData(env, dates.lastWeekStart, dates.lastWeekEnd),
      ]);

      console.log(`✅ 이번 주 데이터: ${thisWeekData.length}건`);
      console.log(`✅ 지난 주 데이터: ${lastWeekData.length}건`);

      // 5. 데이터 검증 (안전장치)
      if (thisWeekData.length === 0) {
        console.error('⚠️ 이번 주 데이터가 없습니다!');
        await sendZeroDataAlert(env);
        return;
      }

      // 최소 데이터 요구사항 검증
      const totalLeads = thisWeekData.reduce((sum: number, row: any) => sum + (row.leads || 0), 0);
      if (totalLeads < 1) {
        console.error('⚠️ 리드가 1건도 없습니다!');
        await sendErrorAlert(env, '리드 데이터 부족: 0건');
        return;
      }

      console.log(`✅ 리드 검증 통과: ${totalLeads}건`);

      // 6. 통계 계산
      console.log('\n📊 통계 계산 중...');
      const thisWeek = calculateWeeklySummary(thisWeekData);
      const lastWeek = calculateWeeklySummary(lastWeekData);

      console.log('\n📊 이번 주 성과:');
      console.log(`  - 리드: ${thisWeek.leads}건`);
      console.log(`  - 지출: $${thisWeek.spend.toFixed(2)}`);
      console.log(`  - CPL: $${thisWeek.cpl.toFixed(2)}`);
      console.log(`  - CTR: ${thisWeek.ctr.toFixed(2)}%`);

      console.log('\n📊 지난 주 성과:');
      console.log(`  - 리드: ${lastWeek.leads}건`);
      console.log(`  - 지출: $${lastWeek.spend.toFixed(2)}`);
      console.log(`  - CPL: $${lastWeek.cpl.toFixed(2)}`);
      console.log(`  - CTR: ${lastWeek.ctr.toFixed(2)}%`);

      // 7. 광고별 성과 분석
      console.log('\n🏆 광고별 성과 분석 중...');
      const adPerformance = getAdPerformance(thisWeekData);
      const topAds = adPerformance.filter((ad) => ad.leads > 0).sort((a, b) => a.cpl - b.cpl).slice(0, 5);
      const worstAds = adPerformance.filter((ad) => ad.leads > 0).sort((a, b) => b.cpl - a.cpl).slice(0, 2);

      console.log(`\n🏆 TOP 5 광고:`);
      topAds.forEach((ad, idx) => {
        console.log(`  ${idx + 1}. ${ad.ad_name}`);
        console.log(`     - 리드: ${ad.leads}건, CPL: $${ad.cpl.toFixed(2)}, CTR: ${ad.ctr.toFixed(2)}%`);
      });

      console.log(`\n⚠️ WORST 2 광고:`);
      worstAds.forEach((ad, idx) => {
        console.log(`  ${idx + 1}. ${ad.ad_name}`);
        console.log(`     - 리드: ${ad.leads}건, CPL: $${ad.cpl.toFixed(2)}, CTR: ${ad.ctr.toFixed(2)}%`);
      });

      // 8. 캠페인별 성과 분석
      console.log('\n💰 캠페인별 성과 분석 중...');
      const campaigns = getCampaignPerformance(thisWeekData);

      console.log(`\n💰 캠페인 성과:`);
      campaigns.forEach((camp) => {
        console.log(`  - ${camp.campaign_name}`);
        console.log(`    지출: $${camp.spend.toFixed(2)} (${camp.spendPercent.toFixed(1)}%)`);
        console.log(`    리드: ${camp.leads}건 (${camp.leadPercent.toFixed(1)}%)`);
        console.log(`    CPL: $${camp.cpl.toFixed(2)}`);
      });

      // 9. 리포트 데이터 구성
      const reportData: ReportData = {
        dates,
        thisWeek,
        lastWeek,
        thisWeekData,
        lastWeekData,
        topAds,
        worstAds,
        campaigns,
      };

      // 10. Gemini AI 분석 (배포 전까지 비활성화 - API 토큰 절약)
      console.log('\n🤖 AI 인사이트 생성 중... (비활성화)');
      const aiInsights = '📊 성과 분석은 현재 준비 중입니다.';

      // 11. 텔레그램 메시지 생성
      console.log('\n📝 리포트 메시지 생성 중...');
      const messages = generateReportMessages(reportData, aiInsights);

      // 12. 텔레그램 발송 (순차 발송으로 순서 보장)
      console.log('\n📤 텔레그램 발송 중...');
      for (let i = 0; i < messages.length; i++) {
        console.log(`  메시지 ${i + 1}/${messages.length} 발송...`);
        await sendTelegramMessage(env, env.TELEGRAM_ADMIN_CHAT_ID, messages[i]);
        if (i < messages.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log('\n✅ 주간 리포트 생성 및 발송 완료!');
      console.log(`\n📊 최종 통계:`);
      console.log(`  - Meta API 수집: ${metaData.length}건`);
      console.log(`  - Supabase 저장: ${saveResult.success}건 성공, ${saveResult.failed}건 실패`);
      console.log(`  - 리드 총계: ${totalLeads}건`);
      console.log(`  - 텔레그램 메시지: ${messages.length}개 발송 완료`);
    } catch (error) {
      console.error('❌ 오류 발생:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await sendErrorAlert(env, errorMessage);
      throw error;
    }
  },

  // HTTP 엔드포인트 - 수동 트리거 및 테스트용
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 수동 리포트 생성 트리거
    if (url.pathname === '/trigger-report') {
      ctx.waitUntil(this.scheduled({} as ScheduledEvent, env, ctx));
      return new Response('✅ 리포트 생성 시작 (콘솔 로그 확인)', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // 헬스 체크
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          service: 'BAS Meta Report Worker',
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          features: ['Meta API 직접 수집', 'Supabase 자동 저장', '데이터 검증'],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 기본 응답
    return new Response(
      `
🤖 BAS Meta Report Worker v2.0

Features:
- ✅ Meta API 직접 데이터 수집
- ✅ Supabase 자동 저장 (Upsert)
- ✅ 데이터 검증 안전장치
- ✅ 텔레그램 리포트 발송

Endpoints:
- POST /trigger-report : 수동으로 리포트 생성
- GET /health : 헬스 체크

Cron Schedule:
- 매주 월요일 00:00 UTC (09:00 KST)
      `.trim(),
      {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }
    );
  },
};
