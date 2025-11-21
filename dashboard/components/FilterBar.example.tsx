/**
 * FilterBar Component - Usage Examples
 *
 * This component provides URL-synchronized filtering for the dashboard.
 * All filter changes are reflected in the URL query parameters, making filters
 * shareable and bookmarkable.
 */

import { FilterBar } from './FilterBar'

/**
 * Example 1: Basic Usage
 *
 * Simply import and use the FilterBar component. It will automatically
 * handle URL parameter synchronization.
 */
export function BasicExample() {
  return (
    <div className="p-8">
      <FilterBar />
    </div>
  )
}

/**
 * Example 2: URL Parameter Format
 *
 * The FilterBar uses the following URL query parameters:
 *
 * - start: Start date in YYYY-MM-DD format
 *   Example: ?start=2025-01-01
 *
 * - end: End date in YYYY-MM-DD format
 *   Example: ?end=2025-01-31
 *
 * - platforms: Comma-separated platform IDs
 *   Example: ?platforms=facebook,instagram
 *
 * - campaigns: Comma-separated campaign names
 *   Example: ?campaigns=summer_sale,winter_promo
 *
 * Full URL example:
 * https://example.com/dashboard?start=2025-01-01&end=2025-01-31&platforms=facebook&campaigns=summer_sale
 */

/**
 * Example 3: Default Values
 *
 * When no URL parameters are present, the FilterBar provides these defaults:
 *
 * - Date Range: Last 7 days (today minus 6 days to today)
 * - Platforms: [] (empty, all platforms)
 * - Campaigns: [] (empty, all campaigns)
 *
 * Note: The default date range is NOT added to the URL automatically.
 * It's only added when the user explicitly changes the date range.
 */

/**
 * Example 4: Reading Filter Values in Other Components
 *
 * To read the current filter values from URL in other components:
 */
import { useSearchParams } from 'next/navigation'

export function DataDisplayComponent() {
  const searchParams = useSearchParams()

  // Read individual parameters
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')
  const platforms = searchParams.get('platforms')?.split(',').filter(Boolean) || []
  const campaigns = searchParams.get('campaigns')?.split(',').filter(Boolean) || []

  return (
    <div>
      <p>Start Date: {startDate || 'Not set'}</p>
      <p>End Date: {endDate || 'Not set'}</p>
      <p>Platforms: {platforms.join(', ') || 'All'}</p>
      <p>Campaigns: {campaigns.join(', ') || 'All'}</p>
    </div>
  )
}

/**
 * Example 5: Using URL Helpers
 *
 * The lib/url-helpers.ts provides utility functions for working with filters:
 */
import { parseFiltersFromURL, buildURLFromFilters, type FilterState } from '@/lib/url-helpers'

export function UrlHelperExample() {
  const searchParams = useSearchParams()

  // Parse all filters at once with defaults
  const filters = parseFiltersFromURL(searchParams)

  console.log('Current filters:', {
    dateRange: filters.dateRange,
    platforms: filters.platforms,
    campaigns: filters.campaigns
  })

  // Build URL from filter state
  const newFilters: Partial<FilterState> = {
    dateRange: {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31')
    },
    platforms: ['facebook', 'instagram'],
    campaigns: ['summer_sale']
  }

  const params = buildURLFromFilters(searchParams, newFilters)
  const newUrl = `?${params.toString()}`
  console.log('New URL:', newUrl)
  // Output: ?start=2025-01-01&end=2025-01-31&platforms=facebook,instagram&campaigns=summer_sale

  return null
}

/**
 * Example 6: Integration with Data Fetching
 *
 * Use filters with API calls:
 */
export function DataFetchingExample() {
  const searchParams = useSearchParams()
  const filters = parseFiltersFromURL(searchParams)

  async function fetchData() {
    const response = await fetch('/api/analytics?' + new URLSearchParams({
      start: filters.dateRange.from?.toISOString().split('T')[0] || '',
      end: filters.dateRange.to?.toISOString().split('T')[0] || '',
      platforms: filters.platforms.join(','),
      campaigns: filters.campaigns.join(',')
    }))

    const data = await response.json()
    return data
  }

  return null
}

/**
 * Example 7: Filter Change Behavior
 *
 * When a user changes any filter:
 * 1. The URL is immediately updated
 * 2. Browser history is updated (back button works)
 * 3. The page does NOT scroll (scroll: false)
 * 4. Components watching searchParams will re-render
 *
 * Active Filter Tags:
 * - Each filter value is shown as a removable tag
 * - Click the × button to remove individual filter values
 * - Click "초기화 (n)" to clear all filters at once
 */

/**
 * Example 8: Accessibility Features
 *
 * The FilterBar includes these accessibility features:
 * - Proper ARIA labels for all interactive elements
 * - Keyboard navigation support (Tab, Enter)
 * - Screen reader friendly button labels
 * - Clear focus indicators
 * - Semantic HTML structure with proper labels
 */

/**
 * Example 9: Responsive Design
 *
 * Layout breakpoints:
 * - Mobile (< 768px): Single column, stacked vertically
 * - Tablet (768px - 1023px): 2 columns
 * - Desktop (≥ 1024px): 4 columns, date picker spans 2 columns
 *
 * All filters remain fully functional on mobile devices.
 */

/**
 * Example 10: Integration Points
 *
 * The FilterBar integrates with three sub-components:
 *
 * 1. DateRangePicker (components/DateRangePicker.tsx)
 *    - Provides date range selection with presets
 *    - Validates dates (max 90 days, no future dates)
 *    - Korean locale support
 *
 * 2. PlatformFilter (components/PlatformFilter.tsx)
 *    - Toggle between Facebook, Instagram, or All
 *    - Multiple selection support
 *
 * 3. CampaignFilter (components/CampaignFilter.tsx)
 *    - Search and select campaigns from database
 *    - Autocomplete with Supabase integration
 *    - Multiple campaign selection
 */

/**
 * TypeScript Types
 */
export interface FilterBarTypes {
  // DateRange interface
  DateRange: {
    from: Date | undefined
    to: Date | undefined
  }

  // FilterState interface
  FilterState: {
    dateRange: {
      from: Date | undefined
      to: Date | undefined
    }
    platforms: string[]
    campaigns: string[]
  }
}

/**
 * Common Issues and Solutions
 *
 * Issue: Filters reset on page refresh
 * Solution: Filters are stored in URL, so they persist across refreshes.
 *           Make sure you're not programmatically clearing the URL.
 *
 * Issue: Date range doesn't show in URL
 * Solution: Default date range (last 7 days) is not added to URL.
 *           Only custom date ranges are added to URL parameters.
 *
 * Issue: Campaign filter not loading data
 * Solution: Check Supabase connection in lib/supabase.ts
 *           Ensure ads_insights_daily table exists and has data
 *
 * Issue: URL parameters not working
 * Solution: Ensure your page component uses 'use client' directive
 *           and properly reads searchParams
 */
