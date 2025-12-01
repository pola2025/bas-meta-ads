'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell,
  ArrowLeft,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Timer,
  CheckCircle,
  Filter,
} from 'lucide-react';

interface Notification {
  id: string;
  clientId: string;
  clientName: string;
  type: string;
  message: string;
  sentAt: string;
  createdAt: string;
}

interface NotificationStats {
  total: number;
  today: number;
  byType: Record<string, number>;
}

export default function NotificationsPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [isValidAdmin, setIsValidAdmin] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const storedKey = localStorage.getItem('adminKey');
    if (storedKey) {
      setAdminKey(storedKey);
      setIsValidAdmin(storedKey === process.env.NEXT_PUBLIC_ADMIN_KEY);
    }
  }, []);

  useEffect(() => {
    if (isValidAdmin) {
      fetchNotifications();
    }
  }, [isValidAdmin, filterType]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filterType !== 'all') {
        params.append('type', filterType);
      }

      const res = await fetch(`/api/admin/notifications?${params}`, {
        headers: { 'x-admin-key': adminKey || '' },
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setStats(data.stats || null);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOld = async (days: number) => {
    if (!confirm(`${days}일 이전 알림을 삭제하시겠습니까?`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/notifications?days=${days}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey || '' },
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        fetchNotifications();
      }
    } catch (err) {
      console.error('Failed to delete notifications:', err);
    } finally {
      setDeleting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    if (type.includes('critical') || type.includes('expired')) {
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    }
    if (type.includes('warning')) {
      return <Timer className="w-4 h-4 text-orange-500" />;
    }
    if (type.includes('notice')) {
      return <Bell className="w-4 h-4 text-amber-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getTypeBadge = (type: string) => {
    const badges: Record<string, string> = {
      token_expiry_critical: 'bg-red-100 text-red-800',
      token_expiry_warning: 'bg-orange-100 text-orange-800',
      token_expiry_notice: 'bg-amber-100 text-amber-800',
      auth_required: 'bg-red-100 text-red-800',
      token_expired: 'bg-red-100 text-red-800',
    };
    return badges[type] || 'bg-neutral-100 text-neutral-800';
  };

  const formatType = (type: string) => {
    const labels: Record<string, string> = {
      token_expiry_critical: '토큰 만료 긴급',
      token_expiry_warning: '토큰 만료 경고',
      token_expiry_notice: '토큰 만료 주의',
      auth_required: '재인증 필요',
      token_expired: '토큰 만료',
    };
    return labels[type] || type;
  };

  if (!isValidAdmin) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Bell className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <p className="text-neutral-600">관리자 인증이 필요합니다</p>
          <Link href="/admin" className="text-blue-600 hover:underline mt-2 block">
            관리자 페이지로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-neutral-800 flex items-center gap-2">
                <Bell className="w-6 h-6" />
                알림 히스토리
              </h1>
              <p className="text-sm text-neutral-500 mt-1">
                토큰 만료 및 인증 관련 알림 기록
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => fetchNotifications()}
              disabled={loading}
              className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            <button
              onClick={() => handleDeleteOld(30)}
              disabled={deleting}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              30일 이전 삭제
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200">
              <div className="text-sm text-neutral-500">전체 알림</div>
              <div className="text-2xl font-bold text-neutral-800">{stats.total}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200">
              <div className="text-sm text-neutral-500">오늘 발송</div>
              <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200">
              <div className="text-sm text-neutral-500">긴급/경고</div>
              <div className="text-2xl font-bold text-red-600">
                {(stats.byType['token_expiry_critical'] || 0) +
                  (stats.byType['token_expiry_warning'] || 0) +
                  (stats.byType['auth_required'] || 0)}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200">
              <div className="text-sm text-neutral-500">주의</div>
              <div className="text-2xl font-bold text-amber-600">
                {stats.byType['token_expiry_notice'] || 0}
              </div>
            </div>
          </div>
        )}

        {/* 필터 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-neutral-500" />
            <span className="text-sm text-neutral-600">필터:</span>
            {['all', 'token_expiry_critical', 'token_expiry_warning', 'token_expiry_notice', 'auth_required'].map(
              (type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    filterType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {type === 'all' ? '전체' : formatType(type)}
                </button>
              )
            )}
          </div>
        </div>

        {/* 알림 목록 */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-neutral-400 mx-auto animate-spin" />
              <p className="text-neutral-500 mt-2">로딩 중...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 text-neutral-300 mx-auto" />
              <p className="text-neutral-500 mt-2">알림 기록이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {notifications.map((notification) => (
                <div key={notification.id} className="p-4 hover:bg-neutral-50">
                  <div className="flex items-start gap-3">
                    {getTypeIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-neutral-800">
                          {notification.clientName}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${getTypeBadge(
                            notification.type
                          )}`}
                        >
                          {formatType(notification.type)}
                        </span>
                      </div>
                      {notification.message && (
                        <p className="text-sm text-neutral-600 mt-1 truncate">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-neutral-400 mt-1">
                        {new Date(notification.sentAt).toLocaleString('ko-KR', {
                          timeZone: 'Asia/Seoul',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 페이지네이션 정보 */}
          {total > 0 && (
            <div className="p-4 border-t border-neutral-100 text-center text-sm text-neutral-500">
              총 {total}개 중 {notifications.length}개 표시
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
