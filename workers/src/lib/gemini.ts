import type { Env } from '../types';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini AI를 사용한 인사이트 생성
export async function generateAIInsights(
  env: Env,
  reportData: {
    thisStats: {
      leads: number;
      spend: number;
      cpl: number;
      ctr: number;
    };
    lastStats: {
      leads: number;
      spend: number;
      cpl: number;
      ctr: number;
    };
    topAds: Array<{
      ad_name: string;
      leads: number;
      cpl: number;
      ctr: number;
    }>;
    campaigns: Array<{
      campaign_name: string;
      leads: number;
      spend: number;
      leadPercent: number;
      spendPercent: number;
    }>;
  }
): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    return '⚠️ Gemini API Key가 설정되지 않아 AI 인사이트를 생성할 수 없습니다.';
  }

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const prompt = `
당신은 Meta 광고 성과를 분석하는 마케팅 전문가입니다.
다음 데이터를 분석하여 실행 가능한 인사이트를 제공해주세요.

## 데이터

### 주간 성과 비교
- 지난 주: 리드 ${reportData.lastStats.leads}건, CPL $${reportData.lastStats.cpl.toFixed(2)}, CTR ${reportData.lastStats.ctr.toFixed(2)}%, 지출 $${reportData.lastStats.spend.toFixed(2)}
- 이번 주: 리드 ${reportData.thisStats.leads}건, CPL $${reportData.thisStats.cpl.toFixed(2)}, CTR ${reportData.thisStats.ctr.toFixed(2)}%, 지출 $${reportData.thisStats.spend.toFixed(2)}

### 광고별 성과 (TOP 3)
${reportData.topAds
  .slice(0, 3)
  .map(
    (ad, idx) =>
      `${idx + 1}. ${ad.ad_name}: 리드 ${ad.leads}건, CPL $${ad.cpl.toFixed(2)}, CTR ${ad.ctr.toFixed(2)}%`
  )
  .join('\n')}

### 캠페인별 성과
${reportData.campaigns
  .map(
    (camp) =>
      `- ${camp.campaign_name}: 리드 ${camp.leads}건 (${camp.leadPercent.toFixed(1)}%), 지출 $${camp.spend.toFixed(2)} (${camp.spendPercent.toFixed(1)}%)`
  )
  .join('\n')}

## 요구사항

다음 형식으로 응답해주세요:

📊 성과 종합 분석
[2-3문장으로 전주 대비 변화, 주요 패턴 설명]

💡 핵심 인사이트 (5-7개)
1. [인사이트 1: 구체적 수치 포함]
2. [인사이트 2]
...

🎯 즉시 실행 가능한 액션 (3-5개)
1. ✅ [액션 제목]
   • [구체적 실행 방법 1]
   • [구체적 실행 방법 2]

2. 🔄 [액션 제목]
   • [구체적 실행 방법]

반드시 구체적인 수치와 실행 가능한 조언을 포함하세요.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('AI 인사이트 생성 실패:', error);
    return '⚠️ AI 인사이트 생성 중 오류가 발생했습니다.';
  }
}
