"""Chart Generation Helpers using Plotly"""

import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
from typing import List, Dict, Any


def create_kpi_trend_chart(data: List[Dict[str, Any]], metric: str, title: str) -> go.Figure:
    """
    Create a line chart for KPI trend over time

    Args:
        data: List of data records with date and metric fields
        metric: The metric to plot (e.g., 'total_impressions', 'total_clicks', 'total_spend', 'total_leads')
        title: Chart title

    Returns:
        Plotly Figure object
    """
    df = pd.DataFrame(data)

    if df.empty:
        # Return empty chart if no data
        fig = go.Figure()
        fig.add_annotation(
            text="데이터가 없습니다",
            xref="paper", yref="paper",
            x=0.5, y=0.5,
            showarrow=False,
            font=dict(size=20, color="gray")
        )
        return fig

    # Determine date column
    date_col = 'week_start' if 'week_start' in df.columns else 'date'

    fig = go.Figure()

    # Metric display names in Korean
    metric_names = {
        'total_impressions': '노출수',
        'total_clicks': '클릭수',
        'total_spend': '지출',
        'total_leads': '리드수'
    }
    display_name = metric_names.get(metric, metric)

    fig.add_trace(go.Scatter(
        x=df[date_col],
        y=df[metric],
        mode='lines+markers',
        name=display_name,
        line=dict(color='#3B82F6', width=3),
        marker=dict(size=8, color='#3B82F6'),
        hovertemplate='<b>%{x}</b><br>' + f'{display_name}: %{{y:,.0f}}<extra></extra>'
    ))

    fig.update_layout(
        title=title,
        xaxis_title='날짜',
        yaxis_title=display_name,
        hovermode='x unified',
        template='plotly_white',
        height=400
    )

    return fig


def create_campaign_comparison_chart(data: List[Dict[str, Any]], metric: str = 'total_spend') -> go.Figure:
    """
    Create a bar chart comparing ad performance

    Args:
        data: List of ad performance records
        metric: The metric to compare (default: 'total_spend')

    Returns:
        Plotly Figure object
    """
    df = pd.DataFrame(data)

    if df.empty:
        fig = go.Figure()
        fig.add_annotation(
            text="데이터가 없습니다",
            xref="paper", yref="paper",
            x=0.5, y=0.5,
            showarrow=False,
            font=dict(size=20, color="gray")
        )
        return fig

    # Sort by metric descending
    df = df.sort_values(metric, ascending=False).head(10)

    fig = go.Figure()

    metric_names = {
        'total_impressions': '노출수',
        'total_clicks': '클릭수',
        'total_spend': '지출',
        'total_leads': '리드수'
    }
    display_name = metric_names.get(metric, metric)

    fig.add_trace(go.Bar(
        x=df['ad_name'] if 'ad_name' in df.columns else df.index,
        y=df[metric],
        marker=dict(
            color=df[metric],
            colorscale='Blues',
            showscale=True
        ),
        hovertemplate='<b>%{x}</b><br>' + f'{display_name}: %{{y:,.2f}}<extra></extra>'
    ))

    fig.update_layout(
        title=f'{display_name} 기준 상위 10개 광고',
        xaxis_title='광고명',
        yaxis_title=display_name,
        template='plotly_white',
        height=400,
        xaxis_tickangle=-45
    )

    return fig


def create_funnel_chart(impressions: int, clicks: int, leads: int) -> go.Figure:
    """
    Create a funnel chart for conversion tracking

    Args:
        impressions: Total impressions
        clicks: Total clicks
        leads: Total leads

    Returns:
        Plotly Figure object
    """
    fig = go.Figure()

    fig.add_trace(go.Funnel(
        y=['노출', '클릭', '리드'],
        x=[impressions, clicks, leads],
        textinfo='value+percent initial',
        marker=dict(
            color=['#93C5FD', '#60A5FA', '#3B82F6']
        ),
        hovertemplate='<b>%{y}</b><br>개수: %{x:,.0f}<br>%{percentInitial}<extra></extra>'
    ))

    fig.update_layout(
        title='전환 퍼널',
        template='plotly_white',
        height=400
    )

    return fig


def create_cpl_trend_chart(data: List[Dict[str, Any]]) -> go.Figure:
    """
    Create a line chart for CPL (Cost Per Lead) trend

    Args:
        data: List of weekly summary records with 'total_spend' and 'total_leads'

    Returns:
        Plotly Figure object
    """
    df = pd.DataFrame(data)

    if df.empty:
        fig = go.Figure()
        fig.add_annotation(
            text="데이터가 없습니다",
            xref="paper", yref="paper",
            x=0.5, y=0.5,
            showarrow=False,
            font=dict(size=20, color="gray")
        )
        return fig

    # Calculate CPL
    df['cpl'] = df.apply(
        lambda row: row['total_spend'] / row['total_leads'] if row['total_leads'] > 0 else 0,
        axis=1
    )

    date_col = 'week_start' if 'week_start' in df.columns else 'date'

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=df[date_col],
        y=df['cpl'],
        mode='lines+markers',
        name='CPL',
        line=dict(color='#10B981', width=3),
        marker=dict(size=8, color='#10B981'),
        hovertemplate='<b>%{x}</b><br>CPL: $%{y:.2f}<extra></extra>'
    ))

    fig.update_layout(
        title='리드당 비용 (CPL) 추이',
        xaxis_title='날짜',
        yaxis_title='CPL ($)',
        hovermode='x unified',
        template='plotly_white',
        height=400
    )

    return fig


def create_pie_chart(data: List[Dict[str, Any]], value_col: str, name_col: str, title: str) -> go.Figure:
    """
    Create a pie chart for distribution

    Args:
        data: List of records
        value_col: Column name for values
        name_col: Column name for labels
        title: Chart title

    Returns:
        Plotly Figure object
    """
    df = pd.DataFrame(data)

    if df.empty:
        fig = go.Figure()
        fig.add_annotation(
            text="No data available",
            xref="paper", yref="paper",
            x=0.5, y=0.5,
            showarrow=False,
            font=dict(size=20, color="gray")
        )
        return fig

    fig = go.Figure()

    fig.add_trace(go.Pie(
        labels=df[name_col],
        values=df[value_col],
        hovertemplate='<b>%{label}</b><br>%{value:,.2f}<br>%{percent}<extra></extra>',
        textinfo='label+percent'
    ))

    fig.update_layout(
        title=title,
        template='plotly_white',
        height=400
    )

    return fig
