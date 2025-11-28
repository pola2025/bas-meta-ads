'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
  BellOff,
  DollarSign,
  History,
  CalendarPlus,
  Database,
  Play,
  Loader2,
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Timer,
  Pause,
  BarChart3,
  Phone,
  Send,
  CalendarCheck,
  UserCheck,
  Info,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';

interface ClientTargets {
  target_leads: number | null;
  target_spend: number | null;
  target_cpl: number | null;
}

interface Client {
  id: string;
  client_id: string;
  client_name: string;
  slug: string | null;
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
  latestDataDate: string | null;
  dataCount: number;
}

interface SystemStatus {
  clients: {
    total: number;
    active: number;
    inactive: number;
    withTelegram: number;
    expiringSoon: number;
    expiringList: Array<{ id: string; name: string; endDate: string }>;
  };
  dataCollection: {
    todayRecords: number;
    yesterdayRecords: number;
    recent7DaysRecords: number;
    recent7DaysImpressions: number;
    missingDataClients: number;
    missingList: Array<{ id: string; name: string; lastDate: string | null }>;
  };
  recent7Days: {
    impressions: number;
    clicks: number;
    leads: number;
    spend: number;
    ctr: number;
    cpl: number;
    avg_watch_time: number;
  };
  reports: {
    latestSentAt: string | null;
    latestType: string | null;
    recentCount: number;
  };
}

interface Payment {
  id: string;
  client_id: string;
  payment_date: string;
  amount: number | null;
  payment_type: string;
  payment_method: string | null;
  memo: string | null;
  service_months: number;
  created_at: string;
}

interface DailyFlowData {
  date: string;
  day: number;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  cpl: number;
  ctr: number;
  avgWatchTime: number;
  hasData: boolean; // 광고 ON 여부 (추이 그래프용)
}

interface MonthlyFlowResponse {
  success: boolean;
  year: number;
  month: number;
  dailyData: DailyFlowData[];
  monthlyTotals: {
    impressions: number;
    clicks: number;
    leads: number;
    spend: number;
    avgCpl: number;
    avgWatchTime: number;
  };
  analysis: {
    avgCpl: number;
    threshold: number;
    inefficientDays: number[];
    inefficientCount: number;
    activeDays: number;    // 광고 운영일 수
    inactiveDays: number;  // 광고 OFF일 수
  };
}

interface BackfillLog {
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface RenewalClient {
  id: string;
  client_name: string;
  contact_phone: string | null;
  contact_name: string | null;
  service_start_date: string | null;
  service_end_date: string | null;
  is_active: boolean;
  telegram_chat_id: string | null;
  dday: number | null;
  status: 'normal' | 'warning' | 'urgent' | 'expired' | 'unknown' | 'unlimited';
  isUnlimited?: boolean;
}

interface RenewalStats {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  noContact: number;
  unlimited: number;
}

interface RateLimitInfo {
  isActive: boolean;
  retryAt: string | null;
  clientId: string | null;
  startDate: string | null;
  endDate: string | null;
  remainingSeconds: number;
}

const initialFormData = {
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
  service_end_date: '',
  telegram_enabled: true,
  unlimited_service: false,
};

export default function AdminPage() {
  const searchParams = useSearchParams();
  const adminKey = searchParams.get('admin');

  const [clients, setClients] = useState<Client[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [tokenValidating, setTokenValidating] = useState(false);
  const [tokenValidation, setTokenValidation] = useState<{ valid: boolean; accountName?: string; error?: string } | null>(null);

  // 복사 상태
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 월간 흐름 차트 상태
  const [monthlyFlowData, setMonthlyFlowData] = useState<MonthlyFlowResponse | null>(null);
  const [flowMonth, setFlowMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowFilter, setFlowFilter] = useState<'general' | 'bizactor'>('general');

  // 결제 모달 상태
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_type: 'monthly',
    memo: '',
    service_months: '3',
    use_today: true,
  });

  // 백필 모달 상태
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [backfillClient, setBackfillClient] = useState<Client | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillLogs, setBackfillLogs] = useState<BackfillLog[]>([]);
  const [backfillResult, setBackfillResult] = useState<{ success: boolean; totalRecords?: number; savedRecords?: number } | null>(null);
  const [backfillForm, setBackfillForm] = useState({
    startDate: '',
    endDate: '',
    preset: 'last7',
  });
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Rate Limit 타이머 상태
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>({
    isActive: false,
    retryAt: null,
    clientId: null,
    startDate: null,
    endDate: null,
    remainingSeconds: 0,
  });
  const rateLimitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 시스템 현황 펼침 상태
  const [showSystemDetails, setShowSystemDetails] = useState(false);

  // 연장관리 상태
  const [renewalClients, setRenewalClients] = useState<RenewalClient[]>([]);
  const [renewalStats, setRenewalStats] = useState<RenewalStats | null>(null);
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [showRenewalSection, setShowRenewalSection] = useState(true);
  const [editingRenewal, setEditingRenewal] = useState<string | null>(null);
  const [renewalForm, setRenewalForm] = useState({ contact_phone: '', contact_name: '' });
  const [smsSending, setSmsSending] = useState<string | null>(null);
  const [extending, setExtending] = useState<string | null>(null);

  // 관리자 키 검증
  const isValidAdmin = adminKey === process.env.NEXT_PUBLIC_ADMIN_KEY;

  // 데이터 로드
  const fetchData = async () => {
    if (!isValidAdmin) return;

    try {
      setLoading(true);

      // 클라이언트 목록과 시스템 상태 동시 조회
      const [clientsRes, statusRes] = await Promise.all([
        fetch('/api/admin/clients', {
          headers: { 'x-admin-key': adminKey || '' },
        }),
        fetch('/api/admin/status', {
          headers: { 'x-admin-key': adminKey || '' },
        }),
      ]);

      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data.clients || []);
      }

      if (statusRes.ok) {
        const data = await statusRes.json();
        setSystemStatus(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchRenewalData();
  }, [isValidAdmin]);

  // 연장관리 데이터 로드
  const fetchRenewalData = async () => {
    if (!isValidAdmin) return;
    setRenewalLoading(true);
    try {
      const res = await fetch('/api/admin/renewal', {
        headers: { 'x-admin-key': adminKey || '' },
      });
      if (res.ok) {
        const data = await res.json();
        setRenewalClients(data.clients || []);
        setRenewalStats(data.stats || null);
      }
    } catch (err) {
      console.error('Renewal data fetch error:', err);
    } finally {
      setRenewalLoading(false);
    }
  };

  // 연락처 업데이트
  const handleUpdateContact = async (clientId: string) => {
    try {
      const res = await fetch('/api/admin/renewal', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
        },
        body: JSON.stringify({
          id: clientId,
          contact_phone: renewalForm.contact_phone,
          contact_name: renewalForm.contact_name,
        }),
      });
      if (res.ok) {
        setEditingRenewal(null);
        fetchRenewalData();
      }
    } catch (err) {
      console.error('Contact update error:', err);
    }
  };

  // SMS 발송
  const handleSendSMS = async (clientId: string, type: string) => {
    if (!confirm(`${type.toUpperCase()} 안내 문자를 발송하시겠습니까?`)) return;

    setSmsSending(clientId);
    try {
      const res = await fetch('/api/admin/renewal/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
        },
        body: JSON.stringify({ id: clientId, type }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ 문자 발송 완료!\n수신: ${data.phone}`);
      } else {
        alert(`❌ 발송 실패: ${data.error}`);
      }
    } catch (err) {
      alert('발송 중 오류가 발생했습니다.');
    } finally {
      setSmsSending(null);
    }
  };

  // 서비스 연장
  const handleExtend = async (clientId: string, months: number = 3) => {
    if (!confirm(`${months}개월 연장하시겠습니까?`)) return;

    setExtending(clientId);
    try {
      const res = await fetch('/api/admin/renewal/extend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
        },
        body: JSON.stringify({ id: clientId, months }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ 연장 완료!\n새 종료일: ${data.extension.newEndDate}`);
        fetchRenewalData();
        fetchData();
      } else {
        alert(`❌ 연장 실패: ${data.error}`);
      }
    } catch (err) {
      alert('연장 처리 중 오류가 발생했습니다.');
    } finally {
      setExtending(null);
    }
  };

  // 월간 흐름 데이터 로드
  const fetchMonthlyFlow = async () => {
    if (!isValidAdmin) return;
    setFlowLoading(true);
    try {
      const res = await fetch(`/api/admin/monthly-flow?year=${flowMonth.year}&month=${flowMonth.month}&filter=${flowFilter}`, {
        headers: { 'x-admin-key': adminKey || '' },
      });
      const data = await res.json();
      if (data.success) {
        setMonthlyFlowData(data);
      }
    } catch (err) {
      console.error('Monthly flow fetch error:', err);
    } finally {
      setFlowLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyFlow();
  }, [isValidAdmin, flowMonth, flowFilter]);

  // 로그 자동 스크롤
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [backfillLogs]);

  // Rate Limit 타이머 업데이트
  useEffect(() => {
    if (rateLimit.isActive && rateLimit.retryAt) {
      rateLimitTimerRef.current = setInterval(() => {
        const now = Date.now();
        const retryTime = new Date(rateLimit.retryAt!).getTime();
        const remaining = Math.max(0, Math.floor((retryTime - now) / 1000));

        if (remaining <= 0) {
          // 타이머 종료 - 자동 재시도
          if (rateLimitTimerRef.current) {
            clearInterval(rateLimitTimerRef.current);
          }
          setRateLimit((prev) => ({ ...prev, isActive: false, remainingSeconds: 0 }));

          // 자동 재시도 실행
          if (rateLimit.clientId && rateLimit.startDate && rateLimit.endDate) {
            handleAutoRetryBackfill();
          }
        } else {
          setRateLimit((prev) => ({ ...prev, remainingSeconds: remaining }));
        }
      }, 1000);
    }

    return () => {
      if (rateLimitTimerRef.current) {
        clearInterval(rateLimitTimerRef.current);
      }
    };
  }, [rateLimit.isActive, rateLimit.retryAt]);

  // Rate Limit 후 자동 재시도
  const handleAutoRetryBackfill = async () => {
    if (!rateLimit.clientId || !rateLimit.startDate || !rateLimit.endDate) return;

    setBackfillLoading(true);
    setBackfillLogs((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
        type: 'info',
        message: '🔄 1시간 대기 완료! 자동 재시도 시작...',
      },
    ]);

    try {
      const response = await fetch('/api/admin/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
        },
        body: JSON.stringify({
          clientId: rateLimit.clientId,
          startDate: rateLimit.startDate,
          endDate: rateLimit.endDate,
        }),
      });

      // 동일한 SSE 처리 로직...
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('스트림을 읽을 수 없습니다.');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7);
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'log') {
                setBackfillLogs((prev) => [...prev, data]);
              } else if (eventType === 'complete') {
                setBackfillResult({
                  success: true,
                  totalRecords: data.totalRecords,
                  savedRecords: data.savedRecords,
                });
              } else if (eventType === 'rateLimit') {
                // 또 Rate Limit 발생
                setRateLimit({
                  isActive: true,
                  retryAt: data.retryAt,
                  clientId: data.clientId,
                  startDate: data.startDate,
                  endDate: data.endDate,
                  remainingSeconds: data.retryAfterMinutes * 60,
                });
              } else if (eventType === 'error') {
                setBackfillResult({ success: false });
              }
            } catch {
              // 무시
            }
            eventType = '';
          }
        }
      }
    } catch (err) {
      setBackfillLogs((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
          type: 'error',
          message: err instanceof Error ? err.message : '재시도 실패',
        },
      ]);
    } finally {
      setBackfillLoading(false);
      fetchData();
    }
  };

  // 토큰 검증
  const validateToken = async () => {
    if (!formData.meta_ad_account_id || !formData.meta_access_token) {
      return;
    }

    setTokenValidating(true);
    setTokenValidation(null);

    try {
      const response = await fetch(
        `https://graph.facebook.com/v22.0/${formData.meta_ad_account_id}?fields=name,account_status&access_token=${formData.meta_access_token}`
      );
      const data = await response.json();

      if (data.error) {
        setTokenValidation({
          valid: false,
          error: data.error.message,
        });
      } else {
        setTokenValidation({
          valid: true,
          accountName: data.name,
        });
      }
    } catch {
      setTokenValidation({
        valid: false,
        error: 'API 호출 실패',
      });
    } finally {
      setTokenValidating(false);
    }
  };

  // 폼 제출 (클라이언트 추가/수정)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const method = editingClient ? 'PATCH' : 'POST';
      const url = editingClient ? `/api/admin/clients/${editingClient.id}` : '/api/admin/clients';

      const body = editingClient
        ? {
            client_name: formData.client_name,
            email: formData.email,
            meta_ad_account_id: formData.meta_ad_account_id || null,
            meta_access_token: formData.meta_access_token || undefined,
            telegram_chat_id: formData.telegram_chat_id || null,
            plan_type: formData.plan_type,
            target_leads: formData.target_leads ? parseInt(formData.target_leads) : null,
            target_spend: formData.target_spend ? parseFloat(formData.target_spend) : null,
            target_cpl: formData.target_cpl ? parseFloat(formData.target_cpl) : null,
            service_start_date: formData.service_start_date || null,
            service_end_date: formData.service_end_date || null,
            telegram_enabled: formData.telegram_enabled,
            unlimited_service: formData.unlimited_service,
          }
        : {
            name: formData.client_name,
            email: formData.email,
            account: formData.meta_ad_account_id || null,
            token: formData.meta_access_token || null,
            telegram: formData.telegram_chat_id || null,
            plan_type: formData.plan_type,
            target_leads: formData.target_leads ? parseInt(formData.target_leads) : null,
            target_spend: formData.target_spend ? parseFloat(formData.target_spend) : null,
            target_cpl: formData.target_cpl ? parseFloat(formData.target_cpl) : null,
            service_start_date: formData.service_start_date || null,
            service_end_date: formData.service_end_date || null,
            telegram_enabled: formData.telegram_enabled,
            unlimited_service: formData.unlimited_service,
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save client');
      }

      setShowModal(false);
      setEditingClient(null);
      setFormData(initialFormData);
      setTokenValidation(null);
      fetchData();
      fetchRenewalData();  // 연장관리 목록도 새로고침
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error saving client');
    } finally {
      setSubmitting(false);
    }
  };

  // 클라이언트 삭제
  const handleDelete = async (client: Client) => {
    if (!confirm(`"${client.client_name}" 클라이언트를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/clients/${client.id}?hard=true`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey || '' },
      });

      if (!response.ok) {
        throw new Error('Failed to delete client');
      }

      fetchData();
      fetchRenewalData();  // 연장관리 목록도 새로고침
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
      service_end_date: client.service_end_date || '',
      telegram_enabled: client.telegram_enabled ?? true,
      unlimited_service: client.service_end_date === null,
    });
    setTokenValidation(null);
    setShowModal(true);
  };

  // 결제 모달 열기
  const openPaymentModal = async (client: Client) => {
    setPaymentClient(client);
    setPaymentForm({
      payment_date: new Date().toISOString().split('T')[0],
      amount: '',
      payment_type: 'monthly',
      memo: '',
      service_months: '3',
      use_today: true,
    });
    setShowPaymentModal(true);

    setPaymentLoading(true);
    try {
      const response = await fetch(`/api/payments?client_id=${client.id}`, {
        headers: { 'x-admin-key': adminKey || '' },
      });
      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments || []);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setPaymentLoading(false);
    }
  };

  // 결제 등록
  const handlePaymentSubmit = async () => {
    if (!paymentClient) return;

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
        },
        body: JSON.stringify({
          client_id: paymentClient.id,
          payment_date: paymentForm.use_today ? null : paymentForm.payment_date,
          amount: paymentForm.amount ? parseFloat(paymentForm.amount) : null,
          payment_type: paymentForm.payment_type,
          memo: paymentForm.memo || null,
          service_months: parseInt(paymentForm.service_months),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to record payment');
      }

      const result = await response.json();
      alert(result.message || '결제가 등록되었습니다.');

      const historyRes = await fetch(`/api/payments?client_id=${paymentClient.id}`, {
        headers: { 'x-admin-key': adminKey || '' },
      });
      if (historyRes.ok) {
        const data = await historyRes.json();
        setPayments(data.payments || []);
      }

      fetchData();

      setPaymentForm({
        payment_date: new Date().toISOString().split('T')[0],
        amount: '',
        payment_type: 'monthly',
        memo: '',
        service_months: '3',
        use_today: true,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error recording payment');
    }
  };

  // 결제 삭제
  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('이 결제 기록을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/payments?id=${paymentId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey || '' },
      });

      if (response.ok && paymentClient) {
        const historyRes = await fetch(`/api/payments?client_id=${paymentClient.id}`, {
          headers: { 'x-admin-key': adminKey || '' },
        });
        if (historyRes.ok) {
          const data = await historyRes.json();
          setPayments(data.payments || []);
        }
      }
    } catch {
      alert('삭제 실패');
    }
  };

  // 백필 모달 열기
  const openBackfillModal = (client: Client) => {
    setBackfillClient(client);
    setBackfillResult(null);
    setBackfillLogs([]);

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    setBackfillForm({
      startDate: weekAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      preset: 'last7',
    });
    setShowBackfillModal(true);
  };

  // 백필 프리셋 변경
  const handleBackfillPresetChange = (preset: string) => {
    const today = new Date();
    let startDate = new Date(today);

    switch (preset) {
      case 'last7':
        startDate.setDate(today.getDate() - 7);
        break;
      case 'last30':
        startDate.setDate(today.getDate() - 30);
        break;
      case 'last90':
        startDate.setDate(today.getDate() - 90);
        break;
      case 'last180':
        startDate.setDate(today.getDate() - 180);
        break;
      case 'last365':
        startDate.setDate(today.getDate() - 365);
        break;
      case 'custom':
        setBackfillForm((prev) => ({ ...prev, preset: 'custom' }));
        return;
    }

    setBackfillForm({
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      preset,
    });
  };

  // 백필 실행 (SSE)
  const handleBackfillSubmit = async () => {
    if (!backfillClient) return;

    if (!backfillForm.startDate || !backfillForm.endDate) {
      alert('시작일과 종료일을 선택해주세요.');
      return;
    }

    setBackfillLoading(true);
    setBackfillResult(null);
    setBackfillLogs([]);

    try {
      const response = await fetch('/api/admin/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
        },
        body: JSON.stringify({
          clientId: backfillClient.id,
          startDate: backfillForm.startDate,
          endDate: backfillForm.endDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '백필 요청 실패');
      }

      // SSE 스트림 처리
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('스트림을 읽을 수 없습니다.');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 이벤트 파싱
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7);
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));

              if (eventType === 'log') {
                setBackfillLogs((prev) => [...prev, data]);
              } else if (eventType === 'progress') {
                // 진행률은 로그에 포함됨
              } else if (eventType === 'complete') {
                setBackfillResult({
                  success: true,
                  totalRecords: data.totalRecords,
                  savedRecords: data.savedRecords,
                });
              } else if (eventType === 'rateLimit') {
                // Rate Limit 발생 - 타이머 시작
                setRateLimit({
                  isActive: true,
                  retryAt: data.retryAt,
                  clientId: data.clientId,
                  startDate: data.startDate,
                  endDate: data.endDate,
                  remainingSeconds: data.retryAfterMinutes * 60,
                });
              } else if (eventType === 'error') {
                setBackfillResult({
                  success: false,
                });
              }
            } catch {
              // JSON 파싱 실패 무시
            }
            eventType = '';
          }
        }
      }
    } catch (err) {
      setBackfillLogs((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
          type: 'error',
          message: err instanceof Error ? err.message : '백필 실패',
        },
      ]);
      setBackfillResult({ success: false });
    } finally {
      setBackfillLoading(false);
      fetchData(); // 데이터 새로고침
    }
  };

  // 새 클라이언트 모달 열기
  const openCreateModal = () => {
    setEditingClient(null);
    setFormData(initialFormData);
    setTokenValidation(null);
    setShowModal(true);
  };

  // URL 복사
  const copyDashboardUrl = (client: Client) => {
    const url = `${window.location.origin}/?client=${client.slug || client.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(client.id);
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
            <h1 className="text-xl font-bold text-neutral-900">BAS Meta Ads - Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              새 클라이언트
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
        ) : (
          <>
            {/* 시스템 현황 카드 */}
            {systemStatus && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setShowSystemDetails(!showSystemDetails)}
                >
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    시스템 현황
                  </h2>
                  {showSystemDetails ? (
                    <ChevronUp className="w-5 h-5 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-400" />
                  )}
                </div>

                {/* 요약 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600 font-medium">활성 클라이언트</div>
                    <div className="text-2xl font-bold text-blue-700">{systemStatus.clients.active}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-green-600 font-medium">7일 도달</div>
                    <div className="text-2xl font-bold text-green-700">
                      {systemStatus.dataCollection.recent7DaysImpressions.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-sm text-purple-600 font-medium">7일 리드</div>
                    <div className="text-2xl font-bold text-purple-700">
                      {systemStatus.recent7Days.leads.toLocaleString()}건
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4">
                    <div className="text-sm text-amber-600 font-medium">평균 CPL</div>
                    <div className="text-2xl font-bold text-amber-700">
                      ${systemStatus.recent7Days.cpl.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-4">
                    <div className="text-sm text-teal-600 font-medium">평균 시청</div>
                    <div className="text-2xl font-bold text-teal-700">
                      {systemStatus.recent7Days.avg_watch_time
                        ? systemStatus.recent7Days.avg_watch_time < 60
                          ? `${systemStatus.recent7Days.avg_watch_time.toFixed(1)}s`
                          : `${Math.floor(systemStatus.recent7Days.avg_watch_time / 60)}:${String(Math.round(systemStatus.recent7Days.avg_watch_time % 60)).padStart(2, '0')}`
                        : '-'
                      }
                    </div>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-4">
                    <div className="text-sm text-rose-600 font-medium">7일 지출</div>
                    <div className="text-2xl font-bold text-rose-700">
                      ${systemStatus.recent7Days.spend.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* 상세 정보 */}
                {showSystemDetails && (
                  <div className="mt-6 space-y-4">
                    {/* 경고 */}
                    {(systemStatus.clients.expiringSoon > 0 || systemStatus.dataCollection.missingDataClients > 0) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-5 h-5" />
                          주의 필요
                        </h3>
                        <ul className="text-sm text-amber-700 space-y-1">
                          {systemStatus.clients.expiringSoon > 0 && (
                            <li>• 서비스 만료 예정: {systemStatus.clients.expiringList.map((c) => c.name).join(', ')}</li>
                          )}
                          {systemStatus.dataCollection.missingDataClients > 0 && (
                            <li>• 데이터 누락: {systemStatus.dataCollection.missingList.map((c) => c.name).join(', ')}</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* 7일 성과 상세 */}
                    <div className="bg-neutral-50 rounded-lg p-4">
                      <h3 className="font-semibold text-neutral-700 flex items-center gap-2 mb-3">
                        <TrendingUp className="w-5 h-5" />
                        최근 7일 전체 성과
                      </h3>
                      <div className="grid grid-cols-3 md:grid-cols-7 gap-4 text-sm">
                        <div>
                          <span className="text-neutral-500">노출</span>
                          <div className="font-semibold">{systemStatus.recent7Days.impressions.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-neutral-500">클릭</span>
                          <div className="font-semibold">{systemStatus.recent7Days.clicks.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-neutral-500">리드</span>
                          <div className="font-semibold">{systemStatus.recent7Days.leads.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-neutral-500">지출</span>
                          <div className="font-semibold">${systemStatus.recent7Days.spend.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-neutral-500">CTR</span>
                          <div className="font-semibold">{systemStatus.recent7Days.ctr}%</div>
                        </div>
                        <div>
                          <span className="text-neutral-500">CPL</span>
                          <div className="font-semibold">${systemStatus.recent7Days.cpl.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-neutral-500">평균 시청</span>
                          <div className="font-semibold text-purple-600">
                            {systemStatus.recent7Days.avg_watch_time
                              ? systemStatus.recent7Days.avg_watch_time < 60
                                ? `${systemStatus.recent7Days.avg_watch_time.toFixed(1)}s`
                                : `${Math.floor(systemStatus.recent7Days.avg_watch_time / 60)}:${String(Math.round(systemStatus.recent7Days.avg_watch_time % 60)).padStart(2, '0')}`
                              : '-'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 월간 광고 효율 흐름 차트 */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  월간 광고 효율 흐름
                </h2>
                <div className="flex items-center gap-2">
                  <select
                    value={`${flowMonth.year}-${flowMonth.month}`}
                    onChange={(e) => {
                      const [y, m] = e.target.value.split('-').map(Number);
                      setFlowMonth({ year: y, month: m });
                    }}
                    className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => {
                      const date = new Date();
                      date.setMonth(date.getMonth() - i);
                      const y = date.getFullYear();
                      const m = date.getMonth() + 1;
                      return (
                        <option key={`${y}-${m}`} value={`${y}-${m}`}>
                          {y}년 {m}월
                        </option>
                      );
                    })}
                  </select>
                  <button
                    onClick={fetchMonthlyFlow}
                    disabled={flowLoading}
                    className="p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg"
                  >
                    <RefreshCw className={`w-4 h-4 ${flowLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* 필터 탭 */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setFlowFilter('general')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    flowFilter === 'general'
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  일반고객
                </button>
                <button
                  onClick={() => setFlowFilter('bizactor')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    flowFilter === 'bizactor'
                      ? 'bg-orange-500 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  비즈액터스쿨
                </button>
              </div>

              {/* 월 합계 스코어카드 */}
              {monthlyFlowData && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-blue-600">도달</div>
                    <div className="text-lg font-bold text-blue-700">
                      {monthlyFlowData.monthlyTotals.impressions.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-green-600">리드</div>
                    <div className="text-lg font-bold text-green-700">{monthlyFlowData.monthlyTotals.leads}</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-amber-600">지출</div>
                    <div className="text-lg font-bold text-amber-700">${monthlyFlowData.monthlyTotals.spend.toLocaleString()}</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-purple-600">평균 CPL</div>
                    <div className="text-lg font-bold text-purple-700">${monthlyFlowData.monthlyTotals.avgCpl}</div>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-teal-600">평균 시청</div>
                    <div className="text-lg font-bold text-teal-700">
                      {monthlyFlowData.monthlyTotals.avgWatchTime > 0
                        ? monthlyFlowData.monthlyTotals.avgWatchTime < 60
                          ? `${monthlyFlowData.monthlyTotals.avgWatchTime}s`
                          : `${Math.floor(monthlyFlowData.monthlyTotals.avgWatchTime / 60)}:${String(Math.round(monthlyFlowData.monthlyTotals.avgWatchTime % 60)).padStart(2, '0')}`
                        : '-'}
                    </div>
                  </div>
                </div>
              )}

              {/* 광고 OFF일 안내 */}
              {monthlyFlowData && monthlyFlowData.analysis.inactiveDays > 0 && (
                <div className="mb-4 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 text-neutral-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-neutral-700">
                      광고 운영: {monthlyFlowData.analysis.activeDays}일 / OFF: {monthlyFlowData.analysis.inactiveDays}일
                    </div>
                    <div className="text-sm text-neutral-500">
                      광고 OFF 기간은 CPL 추이 그래프에서 제외됩니다 (통계 신뢰도 유지)
                    </div>
                  </div>
                </div>
              )}

              {/* 효율 저하 경고 */}
              {monthlyFlowData && monthlyFlowData.analysis.inefficientCount > 0 && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-red-800">효율 저하 구간 감지</div>
                    <div className="text-sm text-red-600">
                      {flowMonth.month}월 {monthlyFlowData.analysis.inefficientDays.join(', ')}일에 CPL이 평균($
                      {monthlyFlowData.analysis.avgCpl}) 대비 30% 이상 높았습니다.
                    </div>
                  </div>
                </div>
              )}

              {/* 차트 */}
              {flowLoading ? (
                <div className="h-80 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : monthlyFlowData && monthlyFlowData.dailyData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={monthlyFlowData.dailyData.map(d => ({
                        ...d,
                        // 광고 OFF일(hasData=false)은 CPL 라인에서 제외 (선 끊김)
                        cplLine: d.hasData ? d.cpl : null,
                      }))}
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="day"
                        tick={({ x, y, payload }) => {
                          const dayOfWeek = new Date(flowMonth.year, flowMonth.month - 1, payload.value).getDay();
                          const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                          const weekdayColors = ['#ef4444', '#6b7280', '#6b7280', '#6b7280', '#6b7280', '#6b7280', '#3b82f6'];
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="#6b7280">
                                {payload.value}
                              </text>
                              <text x={0} y={0} dy={24} textAnchor="middle" fontSize={9} fill={weekdayColors[dayOfWeek]}>
                                {weekdays[dayOfWeek]}
                              </text>
                            </g>
                          );
                        }}
                        tickLine={{ stroke: '#d1d5db' }}
                        height={40}
                      />
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={{ stroke: '#d1d5db' }}
                        label={{ value: '리드', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#6b7280' }}
                        domain={[0, (dataMax: number) => Math.max(dataMax * 1.3, 5)]}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={{ stroke: '#d1d5db' }}
                        label={{ value: 'CPL ($)', angle: 90, position: 'insideRight', fontSize: 11, fill: '#6b7280' }}
                      />
                      <YAxis
                        yAxisId="watchTime"
                        orientation="right"
                        hide={true}
                        domain={[0, (dataMax: number) => Math.max(dataMax * 1.5, 60)]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'spend') return [`$${value.toFixed(2)}`, '지출'];
                          if (name === 'cpl') return [`$${value.toFixed(2)}`, 'CPL'];
                          if (name === 'leads') return [value, '리드'];
                          if (name === 'avgWatchTime') {
                            if (value <= 0) return ['-', '평균 시청'];
                            if (value < 60) return [`${value.toFixed(1)}초`, '평균 시청'];
                            return [`${Math.floor(value / 60)}분 ${Math.round(value % 60)}초`, '평균 시청'];
                          }
                          return [value, name];
                        }}
                        labelFormatter={(day) => `${flowMonth.month}월 ${day}일`}
                      />
                      {/* 효율 저하 구간 하이라이트 */}
                      {monthlyFlowData.analysis.inefficientDays.map((day) => (
                        <ReferenceArea
                          key={day}
                          x1={day - 0.5}
                          x2={day + 0.5}
                          yAxisId="left"
                          fill="#fecaca"
                          fillOpacity={0.4}
                        />
                      ))}
                      {/* 평균 CPL 참조선 */}
                      <ReferenceLine
                        yAxisId="right"
                        y={monthlyFlowData.analysis.avgCpl}
                        stroke="#8b5cf6"
                        strokeDasharray="5 5"
                        label={{
                          value: `평균 CPL $${monthlyFlowData.analysis.avgCpl}`,
                          position: 'right',
                          fontSize: 10,
                          fill: '#8b5cf6',
                        }}
                      />
                      {/* 평균 시청시간 범위 영역 (배경) */}
                      <Area
                        yAxisId="watchTime"
                        type="monotone"
                        dataKey="avgWatchTime"
                        fill="url(#watchTimeGradient)"
                        fillOpacity={0.3}
                        stroke="#14b8a6"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        name="avgWatchTime"
                      />
                      <defs>
                        <linearGradient id="watchTimeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                          <stop offset="50%" stopColor="#14b8a6" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      {/* 리드 막대 */}
                      <Bar
                        yAxisId="left"
                        dataKey="leads"
                        fill="#10b981"
                        radius={[3, 3, 0, 0]}
                        name="leads"
                        minPointSize={3}
                      />
                      {/* CPL 라인 (광고 OFF일 제외) */}
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="cplLine"
                        stroke="#ef4444"
                        strokeWidth={2}
                        connectNulls={false}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          if (!payload?.day || !cx || !cy || !payload.hasData) return <circle cx={0} cy={0} r={0} />;
                          const isHighCpl = payload.cpl >= 20;
                          return (
                            <g>
                              <circle
                                cx={cx}
                                cy={cy}
                                r={isHighCpl ? 5 : 3}
                                fill={isHighCpl ? '#dc2626' : '#ef4444'}
                                stroke={isHighCpl ? '#fef2f2' : 'none'}
                                strokeWidth={isHighCpl ? 2 : 0}
                              />
                              {isHighCpl && (
                                <text x={cx} y={cy - 14} textAnchor="middle" fontSize={12}>
                                  🚨
                                </text>
                              )}
                            </g>
                          );
                        }}
                        activeDot={{ r: 5 }}
                        name="cpl"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-neutral-400">
                  데이터가 없습니다
                </div>
              )}

              {/* 범례 */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span>리드</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span>CPL</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-purple-500" style={{ borderTop: '2px dashed #8b5cf6' }} />
                  <span>평균 CPL</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-teal-400 rounded opacity-50" />
                  <span>평균 시청시간</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-red-200 rounded" />
                  <span>효율 저하 구간</span>
                </div>
              </div>
            </div>

            {/* 연장관리 섹션 */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 mt-6">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowRenewalSection(!showRenewalSection)}
              >
                <h2 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-orange-600" />
                  연장관리
                  {renewalStats && (
                    <span className="text-sm font-normal text-neutral-500">
                      ({renewalStats.total}개 / 만료예정 {renewalStats.expiringSoon}개 / 무제한 {renewalStats.unlimited}개)
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchRenewalData();
                    }}
                    className="p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg"
                  >
                    <RefreshCw className={`w-4 h-4 ${renewalLoading ? 'animate-spin' : ''}`} />
                  </button>
                  {showRenewalSection ? (
                    <ChevronUp className="w-5 h-5 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-400" />
                  )}
                </div>
              </div>

              {showRenewalSection && (
                <div className="mt-4">
                  {/* 통계 카드 */}
                  {renewalStats && (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-blue-700">{renewalStats.total}</div>
                        <div className="text-xs text-blue-600">연장관리</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-green-700">{renewalStats.active}</div>
                        <div className="text-xs text-green-600">활성</div>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-amber-700">{renewalStats.expiringSoon}</div>
                        <div className="text-xs text-amber-600">7일내 만료</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-red-700">{renewalStats.expired}</div>
                        <div className="text-xs text-red-600">만료됨</div>
                      </div>
                      <div className="bg-neutral-100 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-neutral-700">{renewalStats.noContact}</div>
                        <div className="text-xs text-neutral-600">연락처 미등록</div>
                      </div>
                      <div className="bg-indigo-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-indigo-700">{renewalStats.unlimited}</div>
                        <div className="text-xs text-indigo-600">무제한</div>
                      </div>
                    </div>
                  )}

                  {/* 클라이언트 목록 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200">
                          <th className="text-left py-2 px-3 font-medium text-neutral-600">상태</th>
                          <th className="text-left py-2 px-3 font-medium text-neutral-600">클라이언트</th>
                          <th className="text-left py-2 px-3 font-medium text-neutral-600">종료일</th>
                          <th className="text-left py-2 px-3 font-medium text-neutral-600">D-Day</th>
                          <th className="text-left py-2 px-3 font-medium text-neutral-600">연락처</th>
                          <th className="text-left py-2 px-3 font-medium text-neutral-600">담당자</th>
                          <th className="text-center py-2 px-3 font-medium text-neutral-600">문자발송</th>
                          <th className="text-center py-2 px-3 font-medium text-neutral-600">연장</th>
                        </tr>
                      </thead>
                      <tbody>
                        {renewalClients.map((client) => (
                          <tr key={client.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                            {/* 상태 */}
                            <td className="py-2 px-3">
                              <span
                                className={`inline-block w-3 h-3 rounded-full ${
                                  client.status === 'expired'
                                    ? 'bg-red-500'
                                    : client.status === 'urgent'
                                    ? 'bg-orange-500'
                                    : client.status === 'warning'
                                    ? 'bg-amber-500'
                                    : 'bg-green-500'
                                }`}
                              />
                            </td>
                            {/* 클라이언트명 */}
                            <td className="py-2 px-3 font-medium">{client.client_name}</td>
                            {/* 종료일 */}
                            <td className="py-2 px-3 text-neutral-600">
                              {client.isUnlimited ? '무제한' : (client.service_end_date || '-')}
                            </td>
                            {/* D-Day */}
                            <td className="py-2 px-3">
                              {client.isUnlimited ? (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                                  ♾️ 무제한
                                </span>
                              ) : client.dday !== null ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    client.dday < 0
                                      ? 'bg-red-100 text-red-700'
                                      : client.dday <= 3
                                      ? 'bg-orange-100 text-orange-700'
                                      : client.dday <= 7
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}
                                >
                                  {client.dday === 0 ? 'D-DAY' : client.dday > 0 ? `D-${client.dday}` : `D+${Math.abs(client.dday)}`}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            {/* 연락처 */}
                            <td className="py-2 px-3">
                              {editingRenewal === client.id ? (
                                <input
                                  type="text"
                                  value={renewalForm.contact_phone}
                                  onChange={(e) => setRenewalForm({ ...renewalForm, contact_phone: e.target.value })}
                                  className="w-28 px-2 py-1 text-xs border rounded"
                                  placeholder="010-0000-0000"
                                />
                              ) : (
                                <span
                                  className={`cursor-pointer hover:text-blue-600 ${!client.contact_phone ? 'text-neutral-400' : ''}`}
                                  onClick={() => {
                                    setEditingRenewal(client.id);
                                    setRenewalForm({
                                      contact_phone: client.contact_phone || '',
                                      contact_name: client.contact_name || '',
                                    });
                                  }}
                                >
                                  {client.contact_phone || '등록'}
                                </span>
                              )}
                            </td>
                            {/* 담당자 */}
                            <td className="py-2 px-3">
                              {editingRenewal === client.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={renewalForm.contact_name}
                                    onChange={(e) => setRenewalForm({ ...renewalForm, contact_name: e.target.value })}
                                    className="w-16 px-2 py-1 text-xs border rounded"
                                    placeholder="담당자"
                                  />
                                  <button
                                    onClick={() => handleUpdateContact(client.id)}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingRenewal(null)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className={!client.contact_name ? 'text-neutral-400' : ''}>
                                  {client.contact_name || '-'}
                                </span>
                              )}
                            </td>
                            {/* 문자발송 */}
                            <td className="py-2 px-3 text-center">
                              {client.contact_phone ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleSendSMS(client.id, 'd7')}
                                    disabled={smsSending === client.id}
                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                                    title="D-7 안내"
                                  >
                                    D-7
                                  </button>
                                  <button
                                    onClick={() => handleSendSMS(client.id, 'd3')}
                                    disabled={smsSending === client.id}
                                    className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50"
                                    title="D-3 안내"
                                  >
                                    D-3
                                  </button>
                                  <button
                                    onClick={() => handleSendSMS(client.id, 'd0')}
                                    disabled={smsSending === client.id}
                                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                                    title="D-0 안내"
                                  >
                                    D-0
                                  </button>
                                </div>
                              ) : (
                                <span className="text-neutral-400 text-xs">연락처 필요</span>
                              )}
                            </td>
                            {/* 연장 */}
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => handleExtend(client.id, 3)}
                                disabled={extending === client.id}
                                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 mx-auto"
                              >
                                {extending === client.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CalendarPlus className="w-3 h-3" />
                                )}
                                3개월
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {renewalClients.length === 0 && !renewalLoading && (
                    <div className="text-center py-8 text-neutral-500">
                      클라이언트가 없습니다
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 클라이언트 목록 */}
            {clients.length === 0 ? (
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
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-neutral-800">
                  클라이언트 목록 ({clients.length}개)
                </h2>
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
                            <h3 className="text-lg font-semibold text-neutral-900">{client.client_name}</h3>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                client.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
                              목표: {client.targets?.target_leads || '-'}리드 / ${client.targets?.target_spend?.toLocaleString() || '-'}
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              서비스: {client.service_start_date || '-'} ~{' '}
                              {client.service_end_date === null ? (
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
                            <div className="flex items-center gap-2">
                              <Database className="w-4 h-4" />
                              데이터: {client.dataCount.toLocaleString()}건
                              {client.latestDataDate && (
                                <span className="text-neutral-400">(~{client.latestDataDate})</span>
                              )}
                            </div>
                          </div>

                          {/* 대시보드 URL */}
                          <div className="mt-4 flex items-center gap-2">
                            <code className="text-xs bg-neutral-100 px-3 py-1.5 rounded-lg text-neutral-600 flex-1 truncate">
                              {`${typeof window !== 'undefined' ? window.location.origin : ''}/?client=${client.slug || client.id}`}
                            </code>
                            <button
                              onClick={() => copyDashboardUrl(client)}
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
                              href={`/?client=${client.slug || client.id}`}
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
                            onClick={() => openBackfillModal(client)}
                            className="p-2 text-neutral-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="데이터 백필"
                          >
                            <Database className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => openPaymentModal(client)}
                            className="p-2 text-neutral-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="결제 관리"
                          >
                            <DollarSign className="w-5 h-5" />
                          </button>
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
              </div>
            )}
          </>
        )}
      </main>

      {/* 클라이언트 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{editingClient ? '클라이언트 수정' : '새 클라이언트'}</h2>
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
                <label className="block text-sm font-medium text-neutral-700 mb-1">이메일</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contact@example.com (자동 생성됨)"
                />
              </div>

              {/* Meta 연동 */}
              <div className="pt-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3">Meta 광고 연동</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Meta 광고계정 ID</label>
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
                          setTokenValidation(null);
                        }}
                        className="flex-1 px-4 py-2 border border-neutral-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="123456789"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Meta Access Token {editingClient && '(비워두면 기존 유지)'}
                    </label>
                    <input
                      type="password"
                      value={formData.meta_access_token}
                      onChange={(e) => {
                        setFormData({ ...formData, meta_access_token: e.target.value });
                        setTokenValidation(null);
                      }}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="장기 액세스 토큰"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={validateToken}
                        disabled={!formData.meta_ad_account_id || !formData.meta_access_token || tokenValidating}
                        className="px-3 py-1 text-sm bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {tokenValidating ? '검증 중...' : '토큰 검증'}
                      </button>
                      {tokenValidation && (
                        <span className={`text-sm ${tokenValidation.valid ? 'text-green-600' : 'text-red-600'}`}>
                          {tokenValidation.valid ? `✅ ${tokenValidation.accountName}` : `❌ ${tokenValidation.error}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 텔레그램 연동 */}
              <div className="pt-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3">텔레그램 연동</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">텔레그램 채팅 ID</label>
                    <input
                      type="text"
                      value={formData.telegram_chat_id}
                      onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="-1001234567890"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {formData.telegram_enabled ? (
                        <Bell className="w-5 h-5 text-green-600" />
                      ) : (
                        <BellOff className="w-5 h-5 text-neutral-400" />
                      )}
                      <span className="text-sm font-medium text-neutral-700">텔레그램 리포트 발송</span>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">서비스 시작일</label>
                      <input
                        type="date"
                        value={formData.service_start_date}
                        onChange={(e) => setFormData({ ...formData, service_start_date: e.target.value })}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">서비스 종료일</label>
                      <input
                        type="date"
                        value={formData.service_end_date}
                        onChange={(e) =>
                          setFormData({ ...formData, service_end_date: e.target.value, unlimited_service: false })
                        }
                        disabled={formData.unlimited_service}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-neutral-100 disabled:text-neutral-400"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg cursor-pointer hover:bg-neutral-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.unlimited_service}
                      onChange={(e) =>
                        setFormData({ ...formData, unlimited_service: e.target.checked, service_end_date: '' })
                      }
                      className="w-5 h-5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-neutral-700">무제한 서비스</span>
                      <p className="text-xs text-neutral-500">체크하면 서비스 종료일이 없이 무기한 사용</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 플랜 & 목표 */}
              <div className="pt-4 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3">플랜 & 목표</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">플랜 타입</label>
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
                    <label className="block text-sm font-medium text-neutral-700 mb-1">월 목표 리드</label>
                    <input
                      type="number"
                      value={formData.target_leads}
                      onChange={(e) => setFormData({ ...formData, target_leads: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">월 목표 예산 ($)</label>
                    <input
                      type="number"
                      value={formData.target_spend}
                      onChange={(e) => setFormData({ ...formData, target_spend: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="1000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">목표 CPL ($)</label>
                    <input
                      type="number"
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

      {/* 결제 관리 모달 */}
      {showPaymentModal && paymentClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">결제 관리</h2>
                <p className="text-sm text-neutral-500">{paymentClient.client_name}</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 결제 등록 폼 */}
              <div className="bg-green-50 rounded-xl p-4 space-y-4">
                <h3 className="font-semibold text-green-800 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  결제 등록
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <div className="flex gap-4 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={paymentForm.use_today}
                          onChange={() => setPaymentForm({ ...paymentForm, use_today: true })}
                          className="w-4 h-4 text-green-600"
                        />
                        <span className="text-sm font-medium">결제완료 (오늘 날짜)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!paymentForm.use_today}
                          onChange={() => setPaymentForm({ ...paymentForm, use_today: false })}
                          className="w-4 h-4 text-green-600"
                        />
                        <span className="text-sm font-medium">결제일 지정</span>
                      </label>
                    </div>
                    {!paymentForm.use_today && (
                      <input
                        type="date"
                        value={paymentForm.payment_date}
                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">결제 금액 (원)</label>
                    <input
                      type="number"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="330000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">서비스 기간 (개월)</label>
                    <select
                      value={paymentForm.service_months}
                      onChange={(e) => setPaymentForm({ ...paymentForm, service_months: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="1">1개월</option>
                      <option value="3">3개월</option>
                      <option value="6">6개월</option>
                      <option value="12">12개월</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">메모</label>
                    <input
                      type="text"
                      value={paymentForm.memo}
                      onChange={(e) => setPaymentForm({ ...paymentForm, memo: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="카드결제, 계좌이체 등"
                    />
                  </div>
                </div>

                <button
                  onClick={handlePaymentSubmit}
                  className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CalendarPlus className="w-5 h-5" />
                  결제 등록 및 서비스 기간 갱신
                </button>
              </div>

              {/* 결제 히스토리 */}
              <div>
                <h3 className="font-semibold text-neutral-800 flex items-center gap-2 mb-3">
                  <History className="w-5 h-5" />
                  결제 히스토리
                </h3>

                {paymentLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500">결제 기록이 없습니다</div>
                ) : (
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{payment.payment_date}</span>
                            {payment.amount && (
                              <span className="text-green-600 font-semibold">
                                {payment.amount.toLocaleString()}원
                              </span>
                            )}
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              +{payment.service_months}개월
                            </span>
                          </div>
                          {payment.memo && <p className="text-sm text-neutral-500 mt-1">{payment.memo}</p>}
                        </div>
                        <button
                          onClick={() => handleDeletePayment(payment.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 현재 서비스 기간 */}
              <div className="bg-neutral-100 rounded-lg p-4">
                <h4 className="text-sm font-medium text-neutral-600 mb-2">현재 서비스 기간</h4>
                <p className="text-lg font-semibold">
                  {paymentClient.service_start_date || '-'} ~{' '}
                  {paymentClient.service_end_date === null ? (
                    <span className="text-blue-600">무제한</span>
                  ) : (
                    paymentClient.service_end_date || '-'
                  )}
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-full py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 백필 모달 (SSE 실시간 로그) */}
      {showBackfillModal && backfillClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Database className="w-6 h-6 text-purple-600" />
                  데이터 백필
                </h2>
                <p className="text-sm text-neutral-500 mt-1">{backfillClient.client_name}</p>
              </div>
              <button
                onClick={() => setShowBackfillModal(false)}
                disabled={backfillLoading}
                className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* 안내 메시지 */}
              <div className="bg-purple-50 rounded-lg p-4 text-sm text-purple-800">
                <p className="font-medium mb-1">📊 데이터 백필이란?</p>
                <p>
                  Meta API에서 과거 광고 데이터를 가져와 데이터베이스에 저장합니다.
                  <br />
                  90일 초과 시 30일 단위로 자동 분할됩니다.
                </p>
              </div>

              {/* 기간 프리셋 */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">수집 기간 선택</label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {[
                    { value: 'last7', label: '7일' },
                    { value: 'last30', label: '30일' },
                    { value: 'last90', label: '90일' },
                    { value: 'last180', label: '180일' },
                    { value: 'last365', label: '1년' },
                    { value: 'custom', label: '직접입력' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => handleBackfillPresetChange(preset.value)}
                      disabled={backfillLoading}
                      className={`py-2 px-3 text-sm rounded-lg border transition-colors ${
                        backfillForm.preset === preset.value
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:border-purple-400'
                      } disabled:opacity-50`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 날짜 입력 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">시작일</label>
                  <input
                    type="date"
                    value={backfillForm.startDate}
                    onChange={(e) => setBackfillForm({ ...backfillForm, startDate: e.target.value, preset: 'custom' })}
                    disabled={backfillLoading}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">종료일</label>
                  <input
                    type="date"
                    value={backfillForm.endDate}
                    onChange={(e) => setBackfillForm({ ...backfillForm, endDate: e.target.value, preset: 'custom' })}
                    disabled={backfillLoading}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* 기간 요약 */}
              {backfillForm.startDate && backfillForm.endDate && (
                <div className="bg-neutral-100 rounded-lg p-3 text-sm">
                  <span className="text-neutral-600">수집 기간: </span>
                  <span className="font-medium">
                    {backfillForm.startDate} ~ {backfillForm.endDate} (
                    {Math.ceil(
                      (new Date(backfillForm.endDate).getTime() - new Date(backfillForm.startDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )}
                    일)
                  </span>
                </div>
              )}

              {/* 실시간 로그 */}
              {backfillLogs.length > 0 && (
                <div className="border border-neutral-200 rounded-lg">
                  <div className="bg-neutral-800 text-white px-4 py-2 rounded-t-lg text-sm font-medium">실행 로그</div>
                  <div className="bg-neutral-900 text-green-400 p-4 rounded-b-lg h-64 overflow-y-auto font-mono text-xs">
                    {backfillLogs.map((log, index) => (
                      <div
                        key={index}
                        className={`mb-1 ${
                          log.type === 'error'
                            ? 'text-red-400'
                            : log.type === 'warning'
                            ? 'text-yellow-400'
                            : log.type === 'success'
                            ? 'text-green-400'
                            : 'text-neutral-300'
                        }`}
                      >
                        <span className="text-neutral-500">[{log.time}]</span> {log.message}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}

              {/* Rate Limit 타이머 UI */}
              {rateLimit.isActive && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-100 rounded-full">
                      <Timer className="w-6 h-6 text-amber-600 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-amber-800">API Rate Limit 발생</h4>
                      <p className="text-sm text-amber-600">자동 재시도까지 대기 중...</p>
                    </div>
                  </div>

                  {/* 카운트다운 타이머 */}
                  <div className="bg-amber-100 rounded-lg p-4 text-center">
                    <div className="text-4xl font-mono font-bold text-amber-800 mb-2">
                      {String(Math.floor(rateLimit.remainingSeconds / 3600)).padStart(2, '0')}:
                      {String(Math.floor((rateLimit.remainingSeconds % 3600) / 60)).padStart(2, '0')}:
                      {String(rateLimit.remainingSeconds % 60).padStart(2, '0')}
                    </div>
                    <p className="text-sm text-amber-600">
                      재시도 예정: {rateLimit.retryAt && new Date(rateLimit.retryAt).toLocaleTimeString('ko-KR', { hour12: false })}
                    </p>
                  </div>

                  {/* 진행 바 */}
                  <div className="mt-3">
                    <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-1000"
                        style={{ width: `${Math.max(0, 100 - (rateLimit.remainingSeconds / 3600) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-amber-600 mt-3 text-center">
                    ⚠️ 창을 닫아도 타이머는 유지됩니다. 시간이 되면 자동으로 재시도됩니다.
                  </p>
                </div>
              )}

              {/* 결과 메시지 */}
              {backfillResult && !rateLimit.isActive && (
                <div
                  className={`rounded-lg p-4 ${
                    backfillResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  <p className="font-medium">
                    {backfillResult.success
                      ? `✅ 백필 완료! 총 ${backfillResult.totalRecords?.toLocaleString()}건 수집, ${backfillResult.savedRecords?.toLocaleString()}건 저장`
                      : '❌ 백필 실패. 로그를 확인하세요.'}
                  </p>
                </div>
              )}

              {/* 실행 버튼 */}
              <button
                onClick={handleBackfillSubmit}
                disabled={backfillLoading || rateLimit.isActive || !backfillForm.startDate || !backfillForm.endDate}
                className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {backfillLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    백필 실행 중...
                  </>
                ) : rateLimit.isActive ? (
                  <>
                    <Pause className="w-5 h-5" />
                    재시도 대기 중...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    백필 실행
                  </>
                )}
              </button>

              {/* 주의사항 */}
              <div className="text-xs text-neutral-500 space-y-1">
                <p>• 90일 초과 백필은 30일 단위로 자동 분할됩니다.</p>
                <p>• 이미 있는 데이터는 덮어쓰기됩니다.</p>
                <p>• 실행 중 창을 닫으면 진행 상황을 확인할 수 없습니다.</p>
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200">
              <button
                onClick={() => setShowBackfillModal(false)}
                disabled={backfillLoading}
                className="w-full py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
