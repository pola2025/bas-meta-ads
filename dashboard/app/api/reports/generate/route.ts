import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kpi, dailyTrend, platformPerformance, topAds, dateRange, reportType } = body;

    if (!kpi || !dateRange) {
      return NextResponse.json(
        { error: 'KPI 데이터와 날짜 범위가 필요합니다.' },
        { status: 400 }
      );
    }

    // AI 프롬프트 생성
    const prompt = generatePrompt(kpi, dailyTrend, platformPerformance, topAds, dateRange, reportType);

    // Gemini 3.0 Pro API 호출
    // 공식 문서: https://ai.google.dev/gemini-api/docs/gemini-3
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-pro-preview'
    });

    const result = await model.generateContent(prompt);
    const insights = result.response.text();

    return NextResponse.json({
      insights,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'AI 인사이트 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function generatePrompt(
  kpi: any,
  dailyTrend: any[],
  platformPerformance: any[],
  topAds: any[],
  dateRange: { start: string; end: string },
  reportType: 'weekly' | 'monthly' | 'custom'
): string {
  const periodText = reportType === 'weekly' ? '주간' : reportType === 'monthly' ? '월간' : '기간';

  return `당신은 Meta 광고 성과 분석 전문가입니다. 다음 데이터를 기반으로 ${periodText} 리포트를 작성해주세요.

## 분석 기간
${dateRange.start} ~ ${dateRange.end}

## 주요 지표 (KPI)
- 총 리드: ${kpi.total_leads}
- 총 지출: $${kpi.total_spend.toFixed(2)}
- 평균 CPL: $${kpi.avg_cpl.toFixed(2)}
- 평균 CTR: ${kpi.avg_ctr.toFixed(2)}%
- 총 노출수: ${kpi.total_impressions}
- 총 클릭수: ${kpi.total_clicks}
- 평균 CVR: ${kpi.avg_cvr.toFixed(2)}%

${dailyTrend && dailyTrend.length > 0 ? `
## 일별 트렌드 (전체 기간)
${dailyTrend.slice(0, 7).map(d => `- ${d.date}: 리드 ${d.leads}, 지출 $${d.spend.toFixed(2)}, CPL $${d.cpl.toFixed(2)}`).join('\n')}
` : ''}

${platformPerformance && platformPerformance.length > 0 ? `
## 플랫폼별 성과
${platformPerformance.map(p => `- ${p.platform}: 리드 ${p.leads}, 지출 $${p.spend.toFixed(2)}, CPL $${p.cpl.toFixed(2)} (${p.percentage.toFixed(1)}%)`).join('\n')}
` : ''}

${topAds && topAds.length > 0 ? `
## 광고별 상세 성과 (전체 ${topAds.length}개)
${topAds.map((a, i) => `${i+1}. ${a.ad_name}
   - 리드: ${a.leads}개, 지출: ${a.spend.toFixed(2)}
   - CPL: ${a.cpl.toFixed(2)}, CPC: ${a.cpc.toFixed(2)}
   - CTR: ${a.ctr.toFixed(2)}%, CVR: ${a.cvr.toFixed(2)}%
   - 노출: ${a.impressions.toLocaleString()}, 클릭: ${a.clicks}`).join('\n')}
` : ''}

다음 형식으로 분석을 제공해주세요:

1. **핵심 요약** (2-3문장)
2. **기간별 변화 추이**
   - 일별/주별 특이사항 (급격한 증감, 변곡점 등)
   - 요일별 패턴 분석 (가능한 경우)
   - 지난 주/월 대비 변화율 및 원인 추정
3. **광고별 성과 분석**
   - 🏆 최고 성과 광고 (리드, CPL, CVR 기준 TOP 3 각각 언급)
   - ⚠️ 개선 필요 광고 (낮은 CTR/CVR, 높은 CPL 광고 구체적으로 지적)
   - 📊 광고별 주요 변화 및 특이사항
4. **주요 발견사항** (3-4개 bullet points)
4. **성과 분석**
   - 잘된 점
   - 개선이 필요한 점
6. **실행 가능한 제안** (3-5개)

**중요: 다음 항목은 절대 언급하지 마세요:**
- 비딩 전략 (Bidding Strategy) 관련 제안
- 입찰 방식 변경 (수동 입찰, 자동 입찰, Cost Cap, Bid Cap 등)
- 입찰가 조정 권장사항

간결하고 실용적으로 작성하되, 구체적인 숫자와 예시를 포함해주세요.`;
}
