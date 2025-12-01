/**
 * ============================================================================
 * Token Expiry Checker - 토큰 만료 사전 알림
 * ============================================================================
 *
 * Railway cron job으로 매일 실행 (09:00 KST)
 * - 7일 전: 일반 알림 (⚠️)
 * - 3일 전: 경고 알림 (🔶)
 * - 1일 전: 긴급 알림 (🚨)
 *
 * 환경변수:
 * - TELEGRAM_BOT_TOKEN: 텔레그램 봇 토큰
 * - TELEGRAM_ADMIN_CHAT_ID: 관리자 채팅 ID
 * - SUPABASE_URL, SUPABASE_SERVICE_KEY
 *
 * ============================================================================
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * 토큰 만료 예정 클라이언트 조회
 */
async function getExpiringTokens() {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('clients')
    .select('id, client_name, token_expires_at, auth_status, telegram_chat_id')
    .eq('is_active', true)
    .not('token_expires_at', 'is', null)
    .lt('token_expires_at', sevenDaysLater.toISOString())
    .order('token_expires_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch expiring tokens:', error);
    return [];
  }

  return data || [];
}

/**
 * 만료 일수 계산
 */
function getDaysUntilExpiry(expiresAt) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 긴급도 레벨 결정
 */
function getUrgencyLevel(daysLeft) {
  if (daysLeft <= 1) return { level: 'critical', emoji: '🚨', priority: 1 };
  if (daysLeft <= 3) return { level: 'warning', emoji: '🔶', priority: 2 };
  return { level: 'notice', emoji: '⚠️', priority: 3 };
}

/**
 * 텔레그램 알림 발송
 */
async function sendTelegramAlert(chatId, message, parseMode = 'HTML') {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken || !chatId) {
    console.log('⚠️ Telegram credentials not set');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: parseMode
        })
      }
    );

    if (response.ok) {
      return true;
    } else {
      const error = await response.json();
      console.error('Telegram error:', error);
      return false;
    }
  } catch (error) {
    console.error('Telegram API error:', error.message);
    return false;
  }
}

/**
 * 관리자 알림 메시지 생성
 */
function buildAdminAlertMessage(groupedClients) {
  const criticalClients = groupedClients.critical || [];
  const warningClients = groupedClients.warning || [];
  const noticeClients = groupedClients.notice || [];

  let message = '<b>🔐 토큰 만료 예정 알림</b>\n\n';

  // 긴급 (1일 이내)
  if (criticalClients.length > 0) {
    message += '🚨 <b>긴급 (1일 이내)</b>\n';
    criticalClients.forEach(c => {
      const expDate = new Date(c.token_expires_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      message += `• ${c.client_name}: ${c.daysLeft}일 남음\n  만료: ${expDate}\n`;
    });
    message += '\n';
  }

  // 경고 (3일 이내)
  if (warningClients.length > 0) {
    message += '🔶 <b>경고 (3일 이내)</b>\n';
    warningClients.forEach(c => {
      const expDate = new Date(c.token_expires_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      message += `• ${c.client_name}: ${c.daysLeft}일 남음\n  만료: ${expDate}\n`;
    });
    message += '\n';
  }

  // 주의 (7일 이내)
  if (noticeClients.length > 0) {
    message += '⚠️ <b>주의 (7일 이내)</b>\n';
    noticeClients.forEach(c => {
      const expDate = new Date(c.token_expires_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
      message += `• ${c.client_name}: ${c.daysLeft}일 남음\n`;
    });
    message += '\n';
  }

  message += '━━━━━━━━━━━━━━━━━━━━\n';
  message += 'ℹ️ Worker는 만료 1시간 전 자동 갱신을 시도합니다.\n';
  message += '토큰 갱신이 실패하면 Meta 재인증이 필요합니다.';

  return message;
}

/**
 * 알림 로그 저장
 */
async function saveNotificationLog(clientId, notificationType, daysLeft) {
  try {
    await supabase
      .from('notification_logs')
      .insert({
        client_id: clientId,
        notification_type: notificationType,
        message: `Token expiry warning: ${daysLeft} day(s) left`,
        sent_at: new Date().toISOString()
      });
  } catch (error) {
    // 테이블이 없어도 에러 무시 (선택적 기능)
    console.log('⚠️ notification_logs table not available');
  }
}

/**
 * 오늘 이미 알림을 보냈는지 확인
 */
async function hasNotifiedToday(clientId, urgencyLevel) {
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('client_id', clientId)
      .eq('notification_type', `token_expiry_${urgencyLevel}`)
      .gte('sent_at', today)
      .limit(1);

    if (error) return false; // 에러 시 알림 발송 허용
    return data && data.length > 0;
  } catch {
    return false;
  }
}

/**
 * 메인 실행
 */
async function main() {
  console.log('🔍 Checking token expiry status...');
  console.log(`📅 Current time: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST`);

  const expiringClients = await getExpiringTokens();

  if (expiringClients.length === 0) {
    console.log('✅ All tokens are valid (>7 days until expiry)');
    return;
  }

  console.log(`⚠️ Found ${expiringClients.length} client(s) with expiring tokens`);

  // 긴급도별 그룹화
  const grouped = {
    critical: [],
    warning: [],
    notice: []
  };

  for (const client of expiringClients) {
    const daysLeft = getDaysUntilExpiry(client.token_expires_at);
    const urgency = getUrgencyLevel(daysLeft);

    // 이미 만료된 경우 스킵 (auth_required 알림으로 처리됨)
    if (daysLeft < 0) continue;

    grouped[urgency.level].push({
      ...client,
      daysLeft,
      urgency
    });

    console.log(`${urgency.emoji} ${client.client_name}: ${daysLeft}일 남음 (${urgency.level})`);
  }

  const totalExpiring = grouped.critical.length + grouped.warning.length + grouped.notice.length;

  if (totalExpiring === 0) {
    console.log('✅ No actionable token expiry warnings');
    return;
  }

  // 관리자 알림 발송
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (adminChatId) {
    const adminMessage = buildAdminAlertMessage(grouped);
    const sent = await sendTelegramAlert(adminChatId, adminMessage);

    if (sent) {
      console.log('✅ Admin alert sent via Telegram');
    }
  }

  // 긴급/경고 클라이언트 개별 알림 (선택적)
  for (const client of [...grouped.critical, ...grouped.warning]) {
    // 오늘 이미 알림을 보냈는지 확인
    const alreadyNotified = await hasNotifiedToday(client.id, client.urgency.level);

    if (alreadyNotified) {
      console.log(`⏭️ Skip ${client.client_name}: already notified today`);
      continue;
    }

    // 알림 로그 저장
    await saveNotificationLog(client.id, `token_expiry_${client.urgency.level}`, client.daysLeft);
  }

  // 결과 요약
  console.log('\n📊 Summary:');
  console.log(`  - Critical (1일 이내): ${grouped.critical.length}`);
  console.log(`  - Warning (3일 이내): ${grouped.warning.length}`);
  console.log(`  - Notice (7일 이내): ${grouped.notice.length}`);
}

main()
  .then(() => {
    console.log('\n✅ Token expiry check completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
