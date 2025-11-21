'use client'

import { TopAd } from '@/types/analytics'
import { Line } from 'react-chartjs-2'
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

interface AdTrendChartProps {
  ad: TopAd
  dailyData?: Array<{
    date: string
    leads: number
    spend: number
    cpl: number
  }>
}

export function AdTrendChart({ ad, dailyData }: AdTrendChartProps) {
  // 임시 데이터 생성 (실제로는 API에서 가져와야 함)
  const mockDailyData = dailyData || Array.from({ length: 7 }, (_, i) => {
    const baseLeads = ad.leads / 7
    const randomVariation = (Math.random() - 0.5) * 0.4
    const leads = Math.round(baseLeads * (1 + randomVariation))
    const spend = (ad.spend / 7) * (1 + randomVariation)
    const cpl = spend / leads || 0

    const date = new Date()
    date.setDate(date.getDate() - (6 - i))

    return {
      date: date.toISOString().split('T')[0],
      leads,
      spend,
      cpl
    }
  })

  const chartData = {
    labels: mockDailyData.map(d => d.date),
    datasets: [
      {
        label: '리드',
        data: mockDailyData.map(d => d.leads),
        borderColor: '#0066CC',
        backgroundColor: 'rgba(0, 102, 204, 0.1)',
        yAxisID: 'y',
        tension: 0.3
      },
      {
        label: 'CPL ($)',
        data: mockDailyData.map(d => d.cpl),
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
