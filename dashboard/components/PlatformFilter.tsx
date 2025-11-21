'use client';

interface PlatformFilterProps {
  value: string[]; // ['facebook', 'instagram'] 또는 []
  onChange: (platforms: string[]) => void;
}

const PLATFORMS = [
  { id: 'all', label: '전체' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' }
];

export function PlatformFilter({ value, onChange }: PlatformFilterProps) {
  const handleToggle = (platformId: string) => {
    if (platformId === 'all') {
      // 전체 선택 시: 빈 배열로 설정 (전체 선택 의미)
      onChange([]);
    } else {
      // 개별 플랫폼 토글
      if (value.includes(platformId)) {
        // 이미 선택된 플랫폼 제거
        const newValue = value.filter(id => id !== platformId);
        onChange(newValue);
      } else {
        // 플랫폼 추가
        const newValue = [...value, platformId];

        // Facebook과 Instagram 둘 다 선택되면 자동으로 전체 선택으로 전환
        if (newValue.includes('facebook') && newValue.includes('instagram')) {
          onChange([]);
        } else {
          onChange(newValue);
        }
      }
    }
  };

  // 선택 상태 확인
  // 빈 배열 = 전체 선택
  const isAllSelected = value.length === 0;
  const isSelected = (platformId: string) => {
    if (platformId === 'all') {
      return isAllSelected;
    }
    return isAllSelected || value.includes(platformId);
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {PLATFORMS.map((platform) => (
        <button
          key={platform.id}
          type="button"
          onClick={() => handleToggle(platform.id)}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm transition-all
            ${
              isSelected(platform.id)
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
            }
          `}
          aria-pressed={isSelected(platform.id) ? 'true' : 'false'}
          aria-label={`${platform.label} 플랫폼 필터`}
        >
          {platform.label}
        </button>
      ))}
    </div>
  );
}
