'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Plus,
  Users,
  Edit2,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  X,
  Building2,
  Mail,
  Target,
  CreditCard,
  MessageCircle,
  Calendar,
  Bell,
  BellOff
} from 'lucide-react';

interface ClientTargets {
  target_leads: number | null;
  target_spend: number | null;
  target_cpl: number | null;
}

interface Client {
  id: string;
  client_id: string;
  client_name: string;
  email: string;
  meta_ad_account_id: string | null;
  telegram_chat_id: string | null;
  plan_type: string;
  is_active: boolean;
  auth_status: string;
  service_start_date: string | null;
  service_end_date: string | null;
  telegram_enabled: boolean;
  created_at: string;
  updated_at: string;
  targets: ClientTargets | null;
}

interface ClientFormData {
  client_name: string;
  email: string;
  meta_ad_account_id: string;
  meta_access_token: string;
  telegram_chat_id: string;
  plan_type: string;
  target_leads: string;
  target_spend: string;
  target_cpl: string;
  service_start_date: string;
  telegram_enabled: boolean;
  unlimited_service: boolean;
}

const initialFormData: ClientFormData = {
  client_name: '',
  email: '',
  meta_ad_account_id: '',
  meta_access_token: '',
  telegram_chat_id: '',
  plan_type: 'free',
  target_leads: '',
  target_spend: '',
  target_cpl: '',
  service_start_date: new Date().toISOString().split('T')[0],
  telegram_enabled: true,
  unlimited_service: false
};

export default function AdminPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const adminKey = searchParams.get('admin');

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  // 복사 상태
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 관리자 키 검증
  const isValidAdmin = adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;

  // 클라이언트 목록 조회
  const fetchClients = async () => {
    if (!isValidAdmin) return;

    try {
      setLoading(true);
      const response = await fetch('/api/clients', {
        headers: {
          'x-admin-key': adminKey || ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const data = await response.json();
      setClients(data.clients || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [isValidAdmin]);

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const method = editingClient ? 'PUT' : 'POST';
      const body = editingClient
        ? {
            id: editingClient.id,
            client_name: formData.client_name,
            email: formData.email,
            meta_ad_account_id: formData.meta_ad_account_id || null,
            telegram_chat_id: formData.telegram_chat_id || null,
            plan_type: formData.plan_type,
            target_leads: formData.target_leads ? parseInt(formData.target_leads) : null,
            target_spend: formData.target_spend ? parseFloat(formData.target_spend) : null,
            target_cpl: formData.target_cpl ? parseFloat(formData.target_cpl) : null,
            service_start_date: formData.service_start_date || null,
            telegram_enabled: formData.telegram_enabled,
            unlimited_service: formData.unlimited_service
          }
        : {
            client_name: formData.client_name,
            email: formData.email,
            meta_ad_account_id: formData.meta_ad_account_id || null,
            meta_access_token: formData.meta_access_token || null,
            telegram_chat_id: formData.telegram_chat_id || null,
            plan_type: formData.plan_type,
            target_leads: formData.target_leads ? parseInt(formData.target_leads) : null,
            target_spend: formData.target_spend ? parseFloat(formData.target_spend) : null,
            target_cpl: formData.target_cpl ? parseFloat(formData.target_cpl) : null,
            service_start_date: formData.service_start_date || null,
            telegram_enabled: formData.telegram_enabled,
            unlimited_service: formData.unlimited_service
          };

      const response = await fetch('/api/clients', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || ''
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save client');
      }

      // 성공 시 모달 닫고 목록 새로고침
      setShowModal(false);
      setEditingClient(null);
      setFormData(initialFormData);
      fetchClients();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error saving client');
    } finally {
      setSubmitting(false);
    }
  };

  // 클라이언트 삭제
  const handleDelete = async (client: Client) => {
    if (!confirm(`"${client.client_name}" 클라이언트를 완전히 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/clients?id=${client.id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': adminKey || ''
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete client');
      }

      fetchClients();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting client');
    }
  };

  // 수정 모달 열기
  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      client_name: client.client_name,
      email: client.email,
      meta_ad_account_id: client.meta_ad_account_id || '',
      meta_access_token: '',
      telegram_chat_id: client.telegram_chat_id || '',
      plan_type: client.plan_type,
      target_leads: client.targets?.target_leads?.toString() || '',
      target_spend: client.targets?.target_spend?.toString() || '',
      target_cpl: client.targets?.target_cpl?.toString() || '',
      service_start_date: client.service_start_date || new Date().toISOString().split('T')[0],
      telegram_enabled: client.telegram_enabled ?? true,
      unlimited_service: client.service_end_date === null
    });
    setShowModal(true);
  };

  // 새 클라이언트 모달 열기
  const openCreateModal = () => {
    setEditingClient(null);
    setFormData(initialFormData);
    setShowModal(true);
  };

  // URL 복사
  const copyDashboardUrl = (clientId: string) => {
    const url = `${window.location.origin}/?client=${clientId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 권한 없음
  if (!isValidAdmin) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">접근 권한 없음</h1>
          <p className="text-neutral-600">관리자 키가 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold text-neutral-900">클라이언트 관리</h1>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            새 클라이언트
          </button>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
        ) : clients.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Building2 className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">클라이언트가 없습니다</h2>
            <p className="text-neutral-600 mb-6">새 클라이언트를 추가해보세요.</p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              새 클라이언트 추가
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {clients.map((client) => (
              <div
                key={client.id}
                className={`bg-white rounded-xl p-6 border ${
                  client.is_active ? 'border-neutral-200' : 'border-red-200 bg-red-50/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-neutral-900">
                        {client.client_name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          client.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {client.is_active ? '활성' : '비활성'}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                        {client.plan_type}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-neutral-600">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {client.email}
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        {client.meta_ad_account_id || '미설정'}
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        {client.telegram_chat_id || '미설정'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        목표: {client.targets?.target_leads || '-'}리드 / $
                        {client.targets?.target_spend?.toLocaleString() || '-'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        서비스: {client.service_start_date || '-'} ~ {client.service_end_date === null ? (
                          <span className="text-blue-600 font-medium">무제한</span>
                        ) : (
                          client.service_end_date || '-'
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {client.telegram_enabled ? (
                          <>
                            <Bell className="w-4 h-4 text-green-600" />
                            <span className="text-green-600">알림 ON</span>
                          </>
                        ) : (
                          <>
                            <BellOff className="w-4 h-4 text-neutral-400" />
                            <span className="text-neutral-400">알림 OFF</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 대시보드 URL */}
                    <div className="mt-4 flex items-center gap-2">
                      <code className="text-xs bg-neutral-100 px-3 py-1.5 rounded-lg text-neutral-600 flex-1 truncate">
                        {`${typeof window !== 'undefined' ? window.location.origin : ''}/?client=${client.id}`}
                      </code>
                      <button
                        onClick={() => copyDashboardUrl(client.id)}
                        className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                        title="URL 복사"
                      >
                        {copiedId === client.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <a
                        href={`/?client=${client.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                        title="대시보드 열기"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => openEditModal(client)}
                      className="p-2 text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="수정"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(client)}
                      className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingClient ? '클라이언트 수정' : '새 클라이언트'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* 기본 정보 */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  클라이언트명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="회사 또는 브랜드 이름"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contact@example.com"
                  required
                />
              </div>

              {/* Meta 연동 */}
              <div className="pt-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3">Meta 광고 연동</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Meta 광고계정 ID
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 text-sm text-neutral-600 bg-neutral-100 border border-r-0 border-neutral-300 rounded-l-lg">
                        act_
                      </span>
                      <input
                        type="text"
                        value={formData.meta_ad_account_id.replace(/^act_/, '')}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, meta_ad_account_id: value ? `act_${value}` : '' });
                        }}
                        className="flex-1 px-4 py-2 border border-neutral-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="123456789"
                      />
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      비즈니스 설정 → 광고 계정에서 확인 (숫자만 입력)
                    </p>
                  </div>

                  {!editingClient && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Meta Access Token
                      </label>
                      <input
                        type="password"
                        value={formData.meta_access_token}
                        onChange={(e) =>
                          setFormData({ ...formData, meta_access_token: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="장기 액세스 토큰"
                      />
                      <p className="mt-1 text-xs text-neutral-500">
                        Meta Business Suite에서 발급받은 장기 토큰
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 텔레그램 연동 */}
              <div className="pt-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3">텔레그램 연동</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      텔레그램 채팅 ID
                    </label>
                    <input
                      type="text"
                      value={formData.telegram_chat_id}
                      onChange={(e) =>
                        setFormData({ ...formData, telegram_chat_id: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="-1001234567890"
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      리포트를 받을 텔레그램 채팅/그룹 ID
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {formData.telegram_enabled ? (
                        <Bell className="w-5 h-5 text-green-600" />
                      ) : (
                        <BellOff className="w-5 h-5 text-neutral-400" />
                      )}
                      <span className="text-sm font-medium text-neutral-700">
                        텔레그램 리포트 발송
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, telegram_enabled: !formData.telegram_enabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.telegram_enabled ? 'bg-green-600' : 'bg-neutral-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.telegram_enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* 서비스 기간 */}
              <div className="pt-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3">서비스 기간</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      서비스 시작일
                    </label>
                    <input
                      type="date"
                      value={formData.service_start_date}
                      onChange={(e) => setFormData({ ...formData, service_start_date: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <label className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg cursor-pointer hover:bg-neutral-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.unlimited_service}
                      onChange={(e) => setFormData({ ...formData, unlimited_service: e.target.checked })}
                      className="w-5 h-5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-neutral-700">무제한 서비스</span>
                      <p className="text-xs text-neutral-500">
                        체크하면 서비스 종료일이 없이 무기한 사용 가능합니다
                      </p>
                    </div>
                  </label>

                  {!formData.unlimited_service && (
                    <p className="text-xs text-neutral-500">
                      종료일은 시작일 기준 3개월 후 자동 계산됩니다
                    </p>
                  )}
                </div>
              </div>

              {/* 플랜 & 목표 */}
              <div className="pt-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3">플랜 & 목표</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      플랜 타입
                    </label>
                    <select
                      value={formData.plan_type}
                      onChange={(e) => setFormData({ ...formData, plan_type: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      월 목표 리드
                    </label>
                    <input
                      type="number"
                      value={formData.target_leads}
                      onChange={(e) => setFormData({ ...formData, target_leads: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      월 목표 예산 ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.target_spend}
                      onChange={(e) => setFormData({ ...formData, target_spend: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="1000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      목표 CPL ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.target_cpl}
                      onChange={(e) => setFormData({ ...formData, target_cpl: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="10"
                    />
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? '저장 중...' : editingClient ? '수정' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
