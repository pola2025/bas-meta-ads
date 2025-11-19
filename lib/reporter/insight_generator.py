"""
주간 성과 분석 및 인사이트 생성
"""

def generate_weekly_insight(current, previous):
    """
    주간 성과 분석 및 인사이트 생성
    
    Args:
        current (dict): 현재 주간 데이터
            {
                'impressions': int,
                'clicks': int,
                'spend': float,
                'leads': int,
                'cpl': float,
                'ctr': float
            }
        previous (dict): 이전 주간 데이터 (동일 구조)
    
    Returns:
        str: 인사이트 텍스트 (Markdown 형식)
    """
    insights = []
    
    # 1. CPL (효율) 분석
    if previous.get('cpl', 0) > 0:
        cpl_change = ((current.get('cpl', 0) - previous.get('cpl', 0)) / previous.get('cpl', 1)) * 100
    else:
        cpl_change = 0
    
    if cpl_change > 20:
        insights.append(
            f"🔴 **경고**: 리드당 비용(CPL)이 전주 대비 {cpl_change:.1f}% 급증했습니다. "
            f"소재 교체가 시급합니다."
        )
    elif cpl_change < -20:
        insights.append(
            f"🟢 **호재**: 효율이 {abs(cpl_change):.1f}% 개선되었습니다. "
            f"예산 증액을 고려하세요."
        )
    
    # 2. CTR (반응률) 분석
    ctr = current.get('ctr', 0)
    if ctr < 1.0:
        insights.append(
            "⚠️ **주의**: 평균 클릭률(CTR)이 1% 미만(저조)입니다. "
            "썸네일/카피 수정이 필요합니다."
        )
    elif ctr > 3.0:
        insights.append(
            f"🟢 **우수**: 클릭률(CTR)이 {ctr:.1f}%로 매우 양호합니다!"
        )
    
    # 3. 지출 vs 리드 불균형
    if previous.get('spend', 0) > 0 and previous.get('leads', 0) > 0:
        spend_change = ((current.get('spend', 0) - previous.get('spend', 0)) / previous.get('spend', 1)) * 100
        leads_change = ((current.get('leads', 0) - previous.get('leads', 0)) / previous.get('leads', 1)) * 100
        
        if spend_change > 10 and leads_change < -10:
            insights.append(
                "⚠️ **불균형**: 지출은 증가했지만 리드는 감소했습니다. "
                "타겟팅 재검토가 필요합니다."
            )
    
    return "\n".join(insights) if insights else "✅ 전반적으로 안정적인 성과를 유지하고 있습니다."
