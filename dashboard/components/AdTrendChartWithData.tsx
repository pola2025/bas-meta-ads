'use client'

import { TopAd } from '@/types/analytics'
import { Line } from 'react-chartjs-2'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAdDailyTrend } from '@/lib/ad-trend-api'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface AdTrendChartWithDataProps {
  ad: TopAd
}

export function AdTrendChartWithData({ ad }: AdTrendChartWithDataProps) {
  const searchParams = useSearchParams()
  const [dailyData, setDailyData] = useState<Array<{
    date: string
    leads: number
    spend: number
    cpl: number
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const filters = {
          startDate: searchParams.get('start'),
          endDate: searchParams.get('end'),
          platforms: searchParams.get('platforms')?.split(',').filter(Boolean),
          campaigns: searchParams.get('campaigns')?.split(',').filter(Boolean)
        }

        const data = await getAdDailyTrend(ad.ad_name, filters)
        setDailyData(data)
      } catch (error) {
        console.error('Failed to load ad trend data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [ad.ad_name, searchParams])

  const chartData = {
    labels: dailyData.map(d => d.date),
    datasets: [
      {
        label: '리드',
        data: dailyData.map(d => d.leads),
        borderColor: '#0066CC',
        backgroundColor: 'rgba(0, 102, 204, 0.1)',
        yAxisID: 'y',
        tension: 0.3
      },
      {
        label: 'CPL ($)',
        data: dailyData.map(d => d.cpl),
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        yAxisID: 'y1',
        tension: 0.3
      }
    ]
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      title: {
        display: true,
        text: `${ad.ad_name} - 일별 성과 추이`,
        font: {
          size: 14,
          weight: 'bold'
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              if (context.datasetIndex === 1) {
                label += '$' + context.parsed.y.toFixed(2);
              } else {
                label += context.parsed.y;
              }
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: '리드 수'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'CPL ($)'
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600 text-sm">차트 데이터 로딩 중...</p>
          </div>
        </div>
      </div>
    )
  }

  if (dailyData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">데이터가 없습니다</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <Line data={chartData} options={options} />

      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-gray-500">총 리드</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {ad.leads}
          </div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-gray-500">총 지출</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            ${ad.spend.toFixed(2)}
          </div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-gray-500">평균 CPL</div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            ${ad.cpl.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  )
}
