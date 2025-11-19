"""
주간 성과 차트 이미지 생성
"""

import plotly.graph_objects as go
from plotly.subplots import make_subplots
import os

def generate_weekly_chart(data, filename='weekly_chart'):
    """
    주간 성과 차트 이미지 생성
    
    Args:
        data (list): 일별 데이터 리스트
            [
                {'date': '2025-11-11', 'impressions': 1000, 'clicks': 50, 'spend': 10000, 'leads': 5},
                ...
            ]
        filename (str): 저장할 파일명 (확장자 제외)
    
    Returns:
        str: 저장된 이미지 경로
    """
    dates = [d['date'] for d in data]
    impressions = [d.get('impressions', 0) for d in data]
    clicks = [d.get('clicks', 0) for d in data]
    spend = [d.get('spend', 0) for d in data]
    leads = [d.get('leads', 0) for d in data]
    
    # 서브플롯 생성 (2x2 그리드)
    fig = make_subplots(
        rows=2, cols=2,
        subplot_titles=('노출수', '클릭수', '지출 (USD)', '리드수'),
        vertical_spacing=0.15,
        horizontal_spacing=0.12
    )
    
    # 노출수
    fig.add_trace(
        go.Scatter(x=dates, y=impressions, mode='lines+markers', name='노출수', 
                   line=dict(color='#4F46E5', width=2),
                   marker=dict(size=6)),
        row=1, col=1
    )
    
    # 클릭수
    fig.add_trace(
        go.Scatter(x=dates, y=clicks, mode='lines+markers', name='클릭수', 
                   line=dict(color='#10B981', width=2),
                   marker=dict(size=6)),
        row=1, col=2
    )
    
    # 지출
    fig.add_trace(
        go.Scatter(x=dates, y=spend, mode='lines+markers', name='지출', 
                   line=dict(color='#F59E0B', width=2),
                   marker=dict(size=6)),
        row=2, col=1
    )
    
    # 리드수
    fig.add_trace(
        go.Scatter(x=dates, y=leads, mode='lines+markers', name='리드수', 
                   line=dict(color='#EF4444', width=2),
                   marker=dict(size=6)),
        row=2, col=2
    )
    
    # 레이아웃 설정
    fig.update_layout(
        title_text="주간 성과 추이",
        showlegend=False,
        height=700,
        width=900,
        font=dict(size=13),
        paper_bgcolor='white',
        plot_bgcolor='#F9FAFB'
    )
    
    # 축 설정
    fig.update_xaxes(showgrid=True, gridcolor='#E5E7EB')
    fig.update_yaxes(showgrid=True, gridcolor='#E5E7EB')
    
    # 이미지로 저장
    output_path = f"/tmp/{filename}.png"
    
    # /tmp 폴더가 없으면 생성 (Windows 대응)
    os.makedirs("/tmp", exist_ok=True)
    
    fig.write_image(output_path, engine='kaleido')
    
    return output_path
