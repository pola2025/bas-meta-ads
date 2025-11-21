# Data Filtering Debug Implementation

## Issue Description
Dashboard was showing incorrect data - user selected 11-15 to 11-21 (7 days) but seeing $9000 spend which appears to be total/all-time data instead of filtered data.

## Root Cause Analysis

After analyzing the code flow, I identified **the most likely root cause**:

### Issue: Missing Default Date Parameters in URL

**What happens:**
1. User visits dashboard for first time (no URL params)
2. `page.tsx` reads `searchParams.get('start')` → returns `null`
3. `page.tsx` reads `searchParams.get('end')` → returns `null`
4. Filters object has `startDate: null, endDate: null`
5. API receives filters with null dates
6. Database query runs WITHOUT date filters
7. **ALL historical data is returned** (showing $9000+ total spend)

**The Fix:**
I added an automatic URL initialization in `FilterBar.tsx` that sets default dates (last 7 days) if URL parameters are missing.

## Changes Made

### 1. lib/api.ts - Added Comprehensive Debugging

**In `getKPISummary()` function (line 144+):**
- ✅ Logs all incoming filters
- ✅ Warns if startDate/endDate are missing
- ✅ Added `date` column to SELECT query for validation
- ✅ Logs number of rows returned
- ✅ Logs actual date range in returned data
- ✅ Logs total spend, leads, impressions

**In `getDailyTrend()` function (line 13+):**
- ✅ Logs all incoming filters
- ✅ Warns if date filters are missing
- ✅ Logs number of rows returned before aggregation

### 2. app/page.tsx - Client-Side Filter Debugging

**Lines 60-68:**
- ✅ Logs filters constructed from URL searchParams
- ✅ Logs raw URL parameter values

**Lines 86-109: Data Validation Checks**
- ✅ Calculates expected vs actual data points
- ✅ Warns if too many data points for date range
- ✅ Warns if spend is suspiciously high for short range
- ✅ Example: 7 days should have max ~21 data points (3 platforms × 7 days)

### 3. components/FilterBar.tsx - CRITICAL FIX

**Lines 40-66: Auto-Initialize URL with Default Dates**

```typescript
useEffect(() => {
  const hasStartDate = searchParams.has('start')
  const hasEndDate = searchParams.has('end')

  // URL에 날짜가 하나라도 없으면 기본 날짜 설정
  if (!hasStartDate || !hasEndDate) {
    const params = new URLSearchParams(searchParams)

    if (!hasStartDate) {
      params.set('start', defaultStart.toISOString().split('T')[0])
    }
    if (!hasEndDate) {
      params.set('end', today.toISOString().split('T')[0])
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }
}, [searchParams, pathname, router, defaultStart, today])
```

**What this does:**
- Checks if URL has start/end parameters
- If missing, automatically sets them to last 7 days
- Uses `router.replace()` so it doesn't add browser history
- Ensures API **always** receives valid date filters

## How to Test & Verify

### Step 1: Open Browser Developer Console

Navigate to: http://localhost:3003

Press F12 to open DevTools → Console tab

### Step 2: Check Console Logs on Initial Load

You should see:

```
⚠️ FilterBar: Missing date parameters in URL, initializing defaults...
  - has start: false | has end: false
  - Setting default start: 2024-11-15
  - Setting default end: 2024-11-21

🔧 Page.tsx - Filters constructed from URL: {
  "startDate": "2024-11-15",
  "endDate": "2024-11-21",
  "platforms": undefined,
  "campaigns": undefined
}

📊 getKPISummary called with filters: {
  "startDate": "2024-11-15",
  "endDate": "2024-11-21"
}

✅ Applying startDate filter: 2024-11-15
✅ Applying endDate filter: 2024-11-21

📈 Rows returned: 21
📅 Date range in returned data: 2024-11-15 ~ 2024-11-21
💰 Total spend: 1234.56
🎯 Total leads: 45
```

### Step 3: Check for Warnings

**BAD - If you see these warnings:**

```
⚠️ No startDate filter applied - will return ALL data!
⚠️ No endDate filter applied - will return ALL data!
❌ DATA INTEGRITY ISSUE: Too many data points for selected date range!
⚠️ SUSPICIOUS: High spend for short date range!
```

**This means the fix didn't work and filters are still null.**

### Step 4: Manual Testing

1. Select different date ranges using the date picker
2. Check console logs for each change
3. Verify that:
   - URL updates with `?start=YYYY-MM-DD&end=YYYY-MM-DD`
   - API receives the correct filters
   - Data returned matches the date range

### Step 5: Verify Dashboard Numbers

**For 7-day range (2024-11-15 to 2024-11-21):**
- Total Spend should be ~$1000-2000 (not $9000)
- Daily Trend chart should show exactly 7 data points
- Each date should appear once in the chart

**If you still see $9000 for 7 days:**
- Check console for warning messages
- Look for "⚠️ No startDate filter applied"
- This means filters are still not being passed correctly

## Expected Behavior After Fix

### Scenario 1: First Visit (No URL Params)
1. FilterBar detects missing dates
2. Automatically sets `?start=YYYY-MM-DD&end=YYYY-MM-DD` in URL
3. Page re-renders with filters
4. API receives valid date filters
5. **Only 7 days of data returned**

### Scenario 2: User Changes Date Range
1. User selects new dates in DateRangePicker
2. URL updates immediately
3. useEffect triggers in page.tsx
4. API called with new filters
5. Data refreshes with correct date range

### Scenario 3: User Shares URL
1. URL already has `?start=2024-11-15&end=2024-11-21`
2. Page loads with these filters
3. API receives filters from URL
4. Correct data displayed immediately

## Troubleshooting Guide

### Problem: Still seeing all data ($9000 for 7 days)

**Check 1: Are filters null?**
Look for: `"startDate": null, "endDate": null` in console

**Fix:** Make sure FilterBar useEffect is running. Check React DevTools.

**Check 2: Is URL being updated?**
Look in address bar for `?start=2024-11-15&end=2024-11-21`

**Fix:** Check if `router.replace()` is being called in FilterBar.

**Check 3: Is API receiving filters?**
Look for: `✅ Applying startDate filter: 2024-11-15`

**Fix:** If you see `⚠️ No startDate filter applied`, the filters object is not being passed correctly.

### Problem: Date format mismatch

**Symptoms:**
- Filters show correct dates
- API receives filters
- But still getting all data

**Check:** Database date format vs filter date format
- Filter format: `YYYY-MM-DD` (e.g., `2024-11-15`)
- Database format: Should also be `YYYY-MM-DD`

**Fix:** Add this debug in api.ts:
```typescript
console.log('Sample date from DB:', data[0]?.date, typeof data[0]?.date)
```

### Problem: Too many data points

**Symptoms:**
```
❌ DATA INTEGRITY ISSUE: Too many data points for selected date range!
   Expected max: 21 | Actual: 500
```

**This means:**
- Filters are not being applied to the database query
- Or aggregation is not working correctly

**Fix:**
1. Check Supabase query builder syntax
2. Verify `.gte()` and `.lte()` are chaining correctly
3. Test query directly in Supabase SQL editor

## Verification Queries

### Direct Database Query (for comparison)

Run this in Supabase SQL Editor to verify expected results:

```sql
SELECT
  date,
  COUNT(*) as row_count,
  SUM(spend) as total_spend,
  SUM(leads) as total_leads
FROM ads_insights_daily
WHERE date >= '2024-11-15'
  AND date <= '2024-11-21'
GROUP BY date
ORDER BY date;
```

**Expected result:**
- 7 rows (one per date)
- Total spend across all rows should match dashboard

### If results don't match:
- Problem is in aggregation logic (api.ts)
- Or dashboard is calling API multiple times

## Next Steps

1. **Open http://localhost:3003 and check console**
2. **Look for the debug logs I added**
3. **Verify that:**
   - URL has start/end parameters
   - Filters object has valid dates (not null)
   - API receives and applies date filters
   - Correct number of rows returned
   - Date range in data matches selected range

4. **If issue persists:**
   - Take screenshot of console logs
   - Share the exact numbers you're seeing
   - Share the URL with parameters
   - I'll investigate further

## Files Modified

1. `F:\bas_meta\dashboard\lib\api.ts`
   - Added debug logs to getKPISummary
   - Added debug logs to getDailyTrend
   - Added date validation checks

2. `F:\bas_meta\dashboard\app\page.tsx`
   - Added filter construction logs
   - Added data validation checks
   - Added suspicious data warnings

3. `F:\bas_meta\dashboard\components\FilterBar.tsx`
   - **CRITICAL FIX:** Auto-initialize URL with default dates
   - Added debug logs for URL updates

## Developer Notes

**Why this issue is critical:**
- Data integrity is fundamental for reporting
- Users make business decisions based on these numbers
- Wrong data = wrong decisions = lost money

**Why the fix works:**
- Ensures filters are NEVER null
- URL becomes single source of truth
- Easy to debug (just look at URL)
- Shareable (URL includes all filter state)

**Testing checklist:**
- [ ] First load shows last 7 days
- [ ] Changing dates updates data
- [ ] URL reflects current filters
- [ ] Console shows no warnings
- [ ] Data matches expected range
- [ ] No $9000 for 7 days!

---

**Created:** 2025-11-21
**Priority:** CRITICAL - Data Integrity Issue
**Status:** Debugging Added, Fix Implemented, Awaiting Verification
