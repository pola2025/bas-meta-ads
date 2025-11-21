'use client'

import { Download } from 'lucide-react'
import { exportToExcel, ExportData } from '@/lib/excelExport'

interface ExportButtonProps {
  data: ExportData
  disabled?: boolean
}

export function ExportButton({ data, disabled }: ExportButtonProps) {
  const handleExport = () => {
    exportToExcel(data, 'bas-meta-ads-report')
  }

  return (
    <button
      onClick={handleExport}
      disabled={disabled}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
        ${disabled
          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
          : 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
        }
      `}
      aria-label="엑셀 다운로드"
    >
      <Download className="w-4 h-4" />
      <span>엑셀 다운로드</span>
    </button>
  )
}
