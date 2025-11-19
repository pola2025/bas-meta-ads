"""BAS Meta Ads Analytics Dashboard - Main Page"""

import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
from utils.supabase_client import SupabaseDataFetcher
from utils.chart_helpers import (
    create_kpi_trend_chart,
    create_campaign_comparison_chart,
    create_funnel_chart,
    create_cpl_trend_chart
)

# Page config
st.set_page_config(
    page_title="BAS 메타 광고 분석",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .metric-card {
        background-color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric-value {
        font-size: 2.5rem;
        font-weight: bold;
        margin: 10px 0;
    }
    .metric-delta {
        font-size: 0.9rem;
        font-weight: 600;
    }
    .metric-prev {
        font-size: 0.8rem;
        color: #9CA3AF;
        margin-top: 5px;
    }
</style>
""", unsafe_allow_html=True)

# Initialize data fetcher
@st.cache_resource
def get_data_fetcher():
    return SupabaseDataFetcher()

fetcher = get_data_fetcher()

# Sidebar
st.sidebar.title("📊 BAS 메타 광고")
st.sidebar.markdown("---")

# Client filter
clients = fetcher.get_clients()
if not clients:
    st.error("클라이언트 데이터를 불러올 수 없습니다.")
    st.stop()

client_options = ['전체 클라이언트'] + [c['client_name'] for c in clients]
selected_client = st.sidebar.selectbox("클라이언트 선택", client_options)

# Get client_id from selection
client_id = None
if selected_client != '전체 클라이언트':
    client_id = next((c['id'] for c in clients if c['client_name'] == selected_client), None)

# Date range filter
st.sidebar.markdown("### 기간 설정")
date_range = st.sidebar.radio(
    "기간",
    ["최근 7일", "최근 30일", "최근 90일", "직접 설정"],
    index=1  # Default to "최근 30일"
)

if date_range == "직접 설정":
    start_date = st.sidebar.date_input("시작일", datetime.now() - timedelta(days=30))
    end_date = st.sidebar.date_input("종료일", datetime.now())
else:
    days_map = {"최근 7일": 7, "최근 30일": 30, "최근 90일": 90}
    days = days_map[date_range]
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

st.sidebar.markdown("---")
st.sidebar.markdown("**마지막 업데이트:** " + datetime.now().strftime("%Y-%m-%d %H:%M"))

# Main content
st.title("📊 메타 광고 성과 대시보드")
st.markdown(f"**클라이언트:** {selected_client} | **기간:** {start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}")
st.markdown("---")

# Fetch data
@st.cache_data(ttl=300)  # Cache for 5 minutes
def load_weekly_data(_fetcher, client_id, start_date, end_date):
    return _fetcher.get_weekly_summary(
        client_id=client_id,
        start_date=start_date,
        end_date=end_date
    )

weekly_data = load_weekly_data(fetcher, client_id, start_date, end_date)
df_weekly = pd.DataFrame(weekly_data)

# Calculate KPIs
if not df_weekly.empty:
    # Current period
    current_impressions = df_weekly['total_impressions'].sum()
    current_clicks = df_weekly['total_clicks'].sum()
    current_spend = df_weekly['total_spend'].sum()
    current_leads = df_weekly['total_leads'].sum()

    # Previous period (same length)
    period_days = (end_date - start_date).days
    prev_start = start_date - timedelta(days=period_days)
    prev_end = start_date - timedelta(days=1)

    prev_data = load_weekly_data(fetcher, client_id, prev_start, prev_end)
    df_prev = pd.DataFrame(prev_data)

    if not df_prev.empty:
        prev_impressions = df_prev['total_impressions'].sum()
        prev_clicks = df_prev['total_clicks'].sum()
        prev_spend = df_prev['total_spend'].sum()
        prev_leads = df_prev['total_leads'].sum()
    else:
        prev_impressions = prev_clicks = prev_spend = prev_leads = 0

    # Calculate deltas
    def calc_delta(current, previous):
        if previous == 0:
            return 0, current
        percent = ((current - previous) / previous) * 100
        absolute = current - previous
        return percent, absolute

    imp_percent, imp_abs = calc_delta(current_impressions, prev_impressions)
    click_percent, click_abs = calc_delta(current_clicks, prev_clicks)
    spend_percent, spend_abs = calc_delta(current_spend, prev_spend)
    lead_percent, lead_abs = calc_delta(current_leads, prev_leads)

    # KPI Cards
    st.subheader("📈 주요 성과 지표")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric(
            label="총 노출수",
            value=f"{current_impressions:,}",
            delta=f"{imp_percent:.1f}% ({imp_abs:+,})",
            delta_color="normal"
        )
        st.caption(f"이전 기간: {prev_impressions:,}")

    with col2:
        st.metric(
            label="총 클릭수",
            value=f"{current_clicks:,}",
            delta=f"{click_percent:.1f}% ({click_abs:+,})",
            delta_color="normal"
        )
        st.caption(f"이전 기간: {prev_clicks:,}")

    with col3:
        st.metric(
            label="총 지출",
            value=f"${current_spend:,.2f}",
            delta=f"{spend_percent:.1f}% (${spend_abs:+,.2f})",
            delta_color="inverse"  # Lower is better for spend
        )
        st.caption(f"이전 기간: ${prev_spend:,.2f}")

    with col4:
        st.metric(
            label="총 리드수",
            value=f"{current_leads:,}",
            delta=f"{lead_percent:.1f}% ({lead_abs:+,})",
            delta_color="normal"
        )
        st.caption(f"이전 기간: {prev_leads:,}")

    # Additional metrics
    st.markdown("---")
    col5, col6, col7, col8 = st.columns(4)

    ctr = (current_clicks / current_impressions * 100) if current_impressions > 0 else 0
    cpl = (current_spend / current_leads) if current_leads > 0 else 0
    cpc = (current_spend / current_clicks) if current_clicks > 0 else 0
    conversion_rate = (current_leads / current_clicks * 100) if current_clicks > 0 else 0

    with col5:
        st.metric("CTR (클릭률)", f"{ctr:.2f}%")

    with col6:
        st.metric("CPL (리드당 비용)", f"${cpl:.2f}")

    with col7:
        st.metric("CPC (클릭당 비용)", f"${cpc:.2f}")

    with col8:
        st.metric("전환율", f"{conversion_rate:.2f}%")

    # Charts
    st.markdown("---")
    st.subheader("📊 성과 추이")

    tab1, tab2, tab3 = st.tabs(["노출수 & 클릭수", "지출 & 리드수", "비용 지표"])

    with tab1:
        col_left, col_right = st.columns(2)
        with col_left:
            fig_impressions = create_kpi_trend_chart(
                weekly_data,
                'total_impressions',
                '노출수 추이'
            )
            st.plotly_chart(fig_impressions, use_container_width=True)

        with col_right:
            fig_clicks = create_kpi_trend_chart(
                weekly_data,
                'total_clicks',
                '클릭수 추이'
            )
            st.plotly_chart(fig_clicks, use_container_width=True)

    with tab2:
        col_left, col_right = st.columns(2)
        with col_left:
            fig_spend = create_kpi_trend_chart(
                weekly_data,
                'total_spend',
                '지출 추이'
            )
            st.plotly_chart(fig_spend, use_container_width=True)

        with col_right:
            fig_leads = create_kpi_trend_chart(
                weekly_data,
                'total_leads',
                '리드수 추이'
            )
            st.plotly_chart(fig_leads, use_container_width=True)

    with tab3:
        col_left, col_right = st.columns(2)
        with col_left:
            fig_cpl = create_cpl_trend_chart(weekly_data)
            st.plotly_chart(fig_cpl, use_container_width=True)

        with col_right:
            fig_funnel = create_funnel_chart(
                current_impressions,
                current_clicks,
                current_leads
            )
            st.plotly_chart(fig_funnel, use_container_width=True)

    # Ad Performance Comparison
    st.markdown("---")
    st.subheader("🎯 상위 성과 광고")

    ad_comparison_data = fetcher.get_ad_performance_comparison(
        client_id=client_id,
        limit=10
    )

    if ad_comparison_data:
        fig_comparison = create_campaign_comparison_chart(
            ad_comparison_data,
            metric='total_spend'
        )
        st.plotly_chart(fig_comparison, use_container_width=True)

        # Data table
        st.markdown("### 광고 성과 상세")
        df_ads = pd.DataFrame(ad_comparison_data)
        display_cols = ['ad_name', 'total_impressions', 'total_clicks', 'total_spend', 'total_leads']
        available_cols = [col for col in display_cols if col in df_ads.columns]

        if available_cols:
            # Rename columns to Korean
            col_names = {
                'ad_name': '광고명',
                'total_impressions': '노출수',
                'total_clicks': '클릭수',
                'total_spend': '지출',
                'total_leads': '리드수'
            }
            df_display = df_ads[available_cols].head(10)
            df_display = df_display.rename(columns=col_names)

            st.dataframe(
                df_display,
                use_container_width=True,
                hide_index=True
            )

else:
    st.warning("선택한 기간에 데이터가 없습니다.")
    st.info("""
    **데이터를 보려면:**
    - 사이드바에서 **"최근 30일"** 또는 **"최근 90일"**을 선택해보세요
    - 또는 **"직접 설정"**으로 원하는 기간을 지정하세요

    **참고**: 데이터는 주 단위로 수집되므로, 마지막 데이터 수집 시점에 따라 최근 몇 일간은 데이터가 없을 수 있습니다.
    """)

# Footer
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: #9CA3AF; font-size: 0.9rem;'>
    BAS 메타 광고 분석 플랫폼 | Powered by Supabase & Streamlit
</div>
""", unsafe_allow_html=True)
