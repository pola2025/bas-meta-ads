'use client'

import { useState, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface AccordionProps {
  title: string
  icon?: string
  defaultOpen?: boolean
  children: ReactNode
}

export function Accordion({ title, icon, defaultOpen = true, children }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span>{icon}</span>}
          <span className="font-medium text-gray-900">{title}</span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
