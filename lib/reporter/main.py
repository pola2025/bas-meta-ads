"""
BAS Meta Ads - 주간 리포트 생성 및 전송
"""

import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client
from insight_generator import generate_weekly_insight
from chart_generator import generate_weekly_chart
from telegram_sender import send_report_sync

# 환경 변수 로드
load_dotenv()

def get_weekly_summary(client_id, week_start, week_end):
    """
    Supabase에서 주간 요약 데이터 조회
    """
    supabase = create_client(
        os.getenv('SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_KEY')
    )
    
    # 현재 주 데이터
    response = supabase.table('weekly_summary') \
        .select('*') \
        .eq('client_id', client_id) \
        .eq('week_start', week_start) \
        .eq('week_end', week_end) \
        .execute()
    
    current_data = response.data
    
    if not current_data:
        print(f"⚠️ No data found for period {week_start} ~ {week_end}")
        return None, None
    
    # 이전 주 데이터 (7일 전)
    prev_start = (datetime.strptime(week_start, '%Y-%m-%d') - timedelta(days=7)).strftime('%Y-%m-%d')
    prev_end = (datetime.strptime(week_end, '%Y-%m-%d') - timedelta(days=7)).strftime('%Y-%m-%d')
    
    prev_response = supabase.table('weekly_summary') \
        .select('*') \
        .eq('client_id', client_id) \
        .eq('week_start', prev_start) \
        .eq('week_end', prev_end) \
        .execute()
    
    previous_data = prev_response.data if prev_response.data else []
    
    return current_data, previous_data

def aggregate_weekly_data(data):
    """
    주간 데이터를 집계
    """
    total_impressions = sum(d.get('impressions', 0) for d in data)
    total_clicks = sum(d.get('clicks', 0) for d in data)
    total_spend = sum(d.get('spend', 0) for d in data)
    total_leads = sum(d.get('leads', 0) for d in data)
    
    ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
    cpl = (total_spend / total_leads) if total_leads > 0 else 0
    
    return {
        'impressions': total_impressions,
        'clicks': total_clicks,
        'spend': total_spend,
        'leads': total_leads,
        'ctr': ctr,
        'cpl': cpl
    }

def generate_report(client_id, client_name, week_start, week_end):
    """
    주간 리포트 생성 및 전송
    """
    print(f"📊 Generating weekly report for {client_name}")
    print(f"   Period: {week_start} ~ {week_end}")
    
    # 1. 데이터 조회
    current_data, previous_data = get_weekly_summary(client_id, week_start, week_end)
    
    if not current_data:
        print("❌ No data available for reporting")
        return False
    
    # 2. 데이터 집계
    current = aggregate_weekly_data(current_data)
    previous = aggregate_weekly_data(previous_data) if previous_data else current
    
    # 3. 증감률 계산
    spend_change = ((current['spend'] - previous['spend']) / previous['spend'] * 100) if previous['spend'] > 0 else 0
    leads_change = ((current['leads'] - previous['leads']) / previous['leads'] * 100) if previous['leads'] > 0 else 0
    
    # 4. 요약 데이터 구성
    summary = {
        'period_start': week_start,
        'period_end': week_end,
        'spend': current['spend'],
        'spend_change': spend_change,
        'leads': current['leads'],
        'leads_change': leads_change,
        'cpl': current['cpl'],
        'ctr': current['ctr']
    }
    
    # 5. 인사이트 생성
    insights = generate_weekly_insight(current, previous)
    
    # 6. 차트 생성
    chart_data = [
        {
            'date': d.get('week_start', ''),
            'impressions': d.get('impressions', 0),
            'clicks': d.get('clicks', 0),
            'spend': d.get('spend', 0),
            'leads': d.get('leads', 0)
        }
        for d in current_data
    ]
    
    chart_path = generate_weekly_chart(chart_data, f"weekly_chart_{client_id}")
    
    # 7. 텔레그램 전송
    success = send_report_sync(client_name, summary, insights, chart_path)
    
    if success:
        print(f"✅ Report sent successfully for {client_name}")
    else:
        print(f"❌ Failed to send report for {client_name}")
    
    return success

if __name__ == '__main__':
    # 명령행 인자: client_id, client_name, week_start, week_end
    if len(sys.argv) < 5:
        print("Usage: python main.py <client_id> <client_name> <week_start> <week_end>")
        sys.exit(1)
    
    client_id = sys.argv[1]
    client_name = sys.argv[2]
    week_start = sys.argv[3]
    week_end = sys.argv[4]
    
    success = generate_report(client_id, client_name, week_start, week_end)
    sys.exit(0 if success else 1)
