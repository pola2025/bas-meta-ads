/**
 * 텔레그램 리포트용 간단한 차트 생성 모듈
 *
 * chartjs-node-canvas 사용 (Puppeteer보다 훨씬 가볍고 빠름)
 */

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs').promises;
const path = require('path');

// 차트 설정
const width = 800;
const height = 600;
const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width,
  height,
  backgroundColour: 'white',
  plugins: {
    modern: ['chartjs-plugin-datalabels']
  }
});

/**
 * 지난 4주 트렌드 차트 생성
 * @param {Object} data - { weeks: [], leads: [], cpl: [], ctr: [], spend: [] }
 * @param {string} clientName - 클라이언트명
 * @returns {Promise<Buffer>} - PNG 이미지 버퍼
 */
async function generate4WeekTrendChart(data, clientName) {
  const configuration = {
    type: 'line',
    data: {
      labels: data.weeks,
      datasets: [
        {
          label: '리드 수',
          data: data.leads,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          yAxisID: 'y',
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'CPL ($)',
          data: data.cpl,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          yAxisID: 'y1',
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'CTR (%)',
          data: data.ctr,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          yAxisID: 'y2',
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        title: {
          display: true,
          text: `${clientName} - 지난 4주 성과 트렌드`,
          font: { size: 24, weight: 'bold' },
          padding: { top: 10, bottom: 20 }
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: { size: 14 },
            padding: 15,
            usePointStyle: true
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
            text: '리드 수',
            font: { size: 14, weight: 'bold' }
          },
          ticks: {
            font: { size: 12 }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'CPL ($)',
            font: { size: 14, weight: 'bold' }
          },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            font: { size: 12 }
          }
        },
        y2: {
          type: 'linear',
          display: false, // CTR은 범례만 표시 (y축 생략)
          position: 'right'
        },
        x: {
          ticks: {
            font: { size: 12 }
          }
        }
      }
    },
    plugins: [{
      id: 'customCanvasBackgroundColor',
      beforeDraw: (chart) => {
        const ctx = chart.canvas.getContext('2d');
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
      }
    }]
  };

  return await chartJSNodeCanvas.renderToBuffer(configuration);
}

/**
 * 광고별 일별 추이 차트 생성
 * @param {Object} data - { dates: [], leads: [], cpl: [], spend: [] }
 * @param {string} adName - 광고명
 * @returns {Promise<Buffer>} - PNG 이미지 버퍼
 */
async function generateAdDailyTrendChart(data, adName) {
  const adNameShort = adName.length > 40 ? adName.substring(0, 40) + '...' : adName;

  const configuration = {
    type: 'bar',
    data: {
      labels: data.dates,
      datasets: [
        {
          label: '일별 리드',
          data: data.leads,
          backgroundColor: 'rgba(75, 192, 192, 0.7)',
          borderColor: 'rgb(75, 192, 192)',
          borderWidth: 2,
          yAxisID: 'y'
        },
        {
          label: '일별 CPL ($)',
          data: data.cpl,
          type: 'line',
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 7,
          yAxisID: 'y1'
        },
        {
          label: '일별 지출 ($)',
          data: data.spend,
          type: 'line',
          borderColor: 'rgb(255, 159, 64)',
          backgroundColor: 'rgba(255, 159, 64, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 7,
          yAxisID: 'y2',
          hidden: false
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        title: {
          display: true,
          text: `${adNameShort} - 일별 성과`,
          font: { size: 22, weight: 'bold' },
          padding: { top: 10, bottom: 20 }
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: { size: 14 },
            padding: 15,
            usePointStyle: true
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
            text: '리드 수',
            font: { size: 14, weight: 'bold' }
          },
          ticks: {
            font: { size: 12 },
            stepSize: 1
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'CPL ($)',
            font: { size: 14, weight: 'bold' }
          },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            font: { size: 12 }
          }
        },
        y2: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: '지출 ($)',
            font: { size: 14, weight: 'bold' }
          },
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            font: { size: 12 }
          }
        },
        x: {
          ticks: {
            font: { size: 11 }
          }
        }
      }
    },
    plugins: [{
      id: 'customCanvasBackgroundColor',
      beforeDraw: (chart) => {
        const ctx = chart.canvas.getContext('2d');
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
      }
    }]
  };

  return await chartJSNodeCanvas.renderToBuffer(configuration);
}

/**
 * 광고 성과 비교 차트 (TOP 5 vs 개선 필요)
 * @param {Array} topAds - Best 광고 배열
 * @param {Array} worstAds - Worst 광고 배열
 * @param {string} clientName - 클라이언트명
 * @returns {Promise<Buffer>} - PNG 이미지 버퍼
 */
async function generateAdComparisonChart(topAds, worstAds, clientName) {
  const allAds = [...topAds.slice(0, 3), ...worstAds.slice(0, 2)];
  const labels = allAds.map(ad => {
    const name = ad.ad_name.length > 25 ? ad.ad_name.substring(0, 25) + '...' : ad.ad_name;
    return name;
  });

  const configuration = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'CPL ($)',
          data: allAds.map(ad => ad.avg_cpl),
          backgroundColor: allAds.map((_, index) =>
            index < 3 ? 'rgba(75, 192, 192, 0.7)' : 'rgba(255, 99, 132, 0.7)'
          ),
          borderColor: allAds.map((_, index) =>
            index < 3 ? 'rgb(75, 192, 192)' : 'rgb(255, 99, 132)'
          ),
          borderWidth: 2
        }
      ]
    },
    options: {
      indexAxis: 'y', // 가로 막대 차트
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `${clientName} - Best vs 개선 필요 광고 (CPL 비교)`,
          font: { size: 22, weight: 'bold' },
          padding: { top: 10, bottom: 20 }
        },
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'CPL ($)',
            font: { size: 14, weight: 'bold' }
          },
          ticks: {
            font: { size: 12 }
          }
        },
        y: {
          ticks: {
            font: { size: 11 }
          }
        }
      }
    },
    plugins: [{
      id: 'customCanvasBackgroundColor',
      beforeDraw: (chart) => {
        const ctx = chart.canvas.getContext('2d');
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
      }
    }]
  };

  return await chartJSNodeCanvas.renderToBuffer(configuration);
}

module.exports = {
  generate4WeekTrendChart,
  generateAdDailyTrendChart,
  generateAdComparisonChart
};
