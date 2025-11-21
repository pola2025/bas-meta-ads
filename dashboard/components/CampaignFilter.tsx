'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CampaignFilterProps {
  value: string[]; // 선택된 캠페인 이름 배열
  onChange: (campaigns: string[]) => void;
}

export function CampaignFilter({ value, onChange }: CampaignFilterProps) {
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Supabase에서 캠페인 검색 (ILIKE 사용, 최대 20개)
  const fetchCampaigns = useCallback(async (search: string) => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('raw_data')
        .select('campaign_name')
        .order('campaign_name', { ascending: true });

      // 검색어가 있으면 ILIKE로 필터링
      if (search) {
        query = query.ilike('campaign_name', `%${search}%`);
      }

      const { data, error: queryError } = await query.limit(20);

      if (queryError) throw queryError;

      // DISTINCT - 중복 제거 및 null 값 필터링
      const uniqueCampaigns = Array.from(
        new Set(
          data
            .map(item => item.campaign_name)
            .filter((name): name is string => name !== null && name !== '')
        )
      ).slice(0, 20); // 클라이언트 측에서도 20개 제한

      setCampaigns(uniqueCampaigns);
    } catch (err) {
      console.error('캠페인 목록 로드 실패:', err);
      setError('캠페인 목록을 불러오는데 실패했습니다.');
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 검색어 변경 시 debounce 적용하여 API 호출
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        fetchCampaigns(searchTerm);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchTerm, isOpen, fetchCampaigns]);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 이미 선택된 캠페인 제외한 필터링
  const filteredCampaigns = campaigns.filter(campaign =>
    !value.includes(campaign)
  );

  const handleSelect = (campaign: string) => {
    onChange([...value, campaign]);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleRemove = (campaign: string) => {
    onChange(value.filter(c => c !== campaign));
  };

  return (
    <div className="space-y-3" ref={wrapperRef}>
      {/* 검색 입력 */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="캠페인 검색..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            aria-label="캠페인 검색"
          />
        </div>

        {/* 자동완성 드롭다운 */}
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>로딩 중...</span>
              </div>
            ) : error ? (
              <div className="px-4 py-3 text-sm text-red-500">
                {error}
              </div>
            ) : filteredCampaigns.length > 0 ? (
              filteredCampaigns.map((campaign) => (
                <button
                  key={campaign}
                  onClick={() => handleSelect(campaign)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors focus:bg-gray-100 focus:outline-none"
                  role="option"
                >
                  {campaign}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500">
                {searchTerm ? '검색 결과가 없습니다' : '캠페인을 입력하세요'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 선택된 캠페인 태그 */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((campaign) => (
            <div
              key={campaign}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium shadow-sm"
            >
              <span className="max-w-xs truncate">{campaign}</span>
              <button
                onClick={() => handleRemove(campaign)}
                className="hover:bg-blue-100 rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={`${campaign} 제거`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
