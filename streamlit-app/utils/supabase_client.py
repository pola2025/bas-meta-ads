"""Supabase Client for BAS Meta Ads Dashboard"""

import os
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


class SupabaseDataFetcher:
    """Fetch data from Supabase for dashboard"""

    def __init__(self):
        self.client = supabase

    def get_weekly_summary(
        self,
        client_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch weekly summary data

        Args:
            client_id: Filter by client ID (optional)
            start_date: Start date filter (optional)
            end_date: End date filter (optional)

        Returns:
            List of weekly summary records
        """
        query = self.client.table('weekly_summary').select('*')

        if client_id:
            query = query.eq('client_id', client_id)

        if start_date:
            query = query.gte('week_start', start_date.strftime('%Y-%m-%d'))

        if end_date:
            query = query.lte('week_end', end_date.strftime('%Y-%m-%d'))

        query = query.order('week_start', desc=True)

        response = query.execute()
        return response.data

    def get_raw_data(
        self,
        client_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch raw data (daily ad performance)

        Args:
            client_id: Filter by client ID (optional)
            start_date: Start date filter (optional)
            end_date: End date filter (optional)

        Returns:
            List of raw data records
        """
        query = self.client.table('raw_data').select('*')

        if client_id:
            query = query.eq('client_id', client_id)

        if start_date:
            query = query.gte('date', start_date.strftime('%Y-%m-%d'))

        if end_date:
            query = query.lte('date', end_date.strftime('%Y-%m-%d'))

        query = query.order('date', desc=True)

        response = query.execute()
        return response.data

    def get_clients(self) -> List[Dict[str, Any]]:
        """
        Get list of all clients

        Returns:
            List of client records
        """
        response = self.client.table('clients').select('*').execute()
        return response.data

    def get_kpi_summary(self, client_id: Optional[str] = None) -> Dict[str, float]:
        """
        Get overall KPI summary

        Args:
            client_id: Filter by client ID (optional)

        Returns:
            Dictionary with total impressions, clicks, spend, leads
        """
        query = self.client.table('weekly_summary').select(
            'total_impressions, total_clicks, total_spend, total_leads'
        )

        if client_id:
            query = query.eq('client_id', client_id)

        response = query.execute()
        data = response.data

        if not data:
            return {
                'total_impressions': 0,
                'total_clicks': 0,
                'total_spend': 0.0,
                'total_leads': 0
            }

        return {
            'total_impressions': sum(row.get('total_impressions', 0) for row in data),
            'total_clicks': sum(row.get('total_clicks', 0) for row in data),
            'total_spend': sum(row.get('total_spend', 0.0) for row in data),
            'total_leads': sum(row.get('total_leads', 0) for row in data)
        }

    def get_last_7_days_trend(self, client_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get last 7 days trend data from raw_data

        Args:
            client_id: Filter by client ID (optional)

        Returns:
            List of daily performance data
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)

        return self.get_raw_data(
            client_id=client_id,
            start_date=start_date,
            end_date=end_date
        )

    def get_ad_performance_comparison(
        self,
        client_id: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get top performing ads by spend

        Args:
            client_id: Filter by client ID (optional)
            limit: Number of ads to return

        Returns:
            List of ad performance records
        """
        query = self.client.table('weekly_summary').select('*')

        if client_id:
            query = query.eq('client_id', client_id)

        query = query.order('total_spend', desc=True).limit(limit)

        response = query.execute()
        return response.data
