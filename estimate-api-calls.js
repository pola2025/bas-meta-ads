const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function estimateApiCalls() {
  // 기존 수집된 데이터에서 일별 평균 레코드 수 확인
  const { data, error } = await supabase
    .from('raw_data')
    .select('date')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  // 날짜별 레코드 수 계산
  const dateCount = {};
  data.forEach(d => {
    dateCount[d.date] = (dateCount[d.date] || 0) + 1;
  });

  const dates = Object.keys(dateCount);
  const totalRecords = data.length;
  const avgRecordsPerDay = totalRecords / dates.length;

  console.log('=== 기존 데이터 분석 ===');
  console.log('수집된 총 레코드:', totalRecords.toLocaleString());
  console.log('수집된 일수:', dates.length);
  console.log('일별 평균 레코드:', avgRecordsPerDay.toFixed(1));

  // 미수집 기간 추정
  const missingDays = 176; // 2025-06-03 ~ 2025-11-25
  const estimatedRecords = Math.round(missingDays * avgRecordsPerDay);

  console.log('\n=== 미수집 기간 추정 ===');
  console.log('미수집 일수:', missingDays);
  console.log('예상 레코드 수:', estimatedRecords.toLocaleString());

  // API 호출 추정 (페이지당 90개)
  const recordsPerPage = 90;
  const estimatedPages = Math.ceil(estimatedRecords / recordsPerPage);

  console.log('\n=== API 호출 추정 ===');
  console.log('페이지당 레코드:', recordsPerPage);
  console.log('예상 페이지 수 (= API 호출 수):', estimatedPages);

  // 월별 분할 시
  console.log('\n=== 월별 분할 시 ===');
  const months = [
    { name: '6월 잔여', days: 28 },
    { name: '7월', days: 31 },
    { name: '8월', days: 31 },
    { name: '9월', days: 30 },
    { name: '10월', days: 31 },
    { name: '11월', days: 25 }
  ];

  let totalCalls = 0;
  months.forEach(m => {
    const records = Math.round(m.days * avgRecordsPerDay);
    const pages = Math.ceil(records / recordsPerPage);
    totalCalls += pages;
    console.log('  ' + m.name + ': ' + m.days + '일 → 약 ' + records + '개 레코드 → ' + pages + '회 API 호출');
  });

  console.log('\n  총 예상 API 호출: ' + totalCalls + '회');
  console.log('  Rate Limit (200/hour) 대비: ' + (totalCalls/200*100).toFixed(1) + '%');

  if (totalCalls < 200) {
    console.log('\n✅ 한 번에 수집 가능! (Rate Limit 이내)');
  } else {
    console.log('\n⚠️ Rate Limit 초과 가능성 - 월별 분할 권장');
  }
}

estimateApiCalls();
