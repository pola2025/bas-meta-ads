const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { decrypt } = require('./encryption');

/**
 * ============================================================================
 * Token Manager - Access Token 자동 갱신
 * ============================================================================
 *
 * 역할 구분:
 *
 * 1. ensureValidToken() - Worker 실행 전 동기 갱신
 *    - 데이터 수집 작업 시작 전 MUST 호출
 *    - 만료되었거나 1시간 이내 만료 예정이면 즉시 갱신
 *    - 갱신 실패 시 에러 throw (데이터 수집 중단)
 *    - 목적: 데이터 수집의 성공을 보장
 *
 * 2. check_expiring_tokens (pg_cron) - 사전 모니터링
 *    - 매일 08:00 KST 실행
 *    - 7일 이내 만료 예정 토큰 감지
 *    - Admin에게 알림 전송 (수동 조치 필요 상황 대비)
 *    - 목적: 자동 갱신 실패 대비 안전장치
 *             (예: 사용자가 앱 접근 권한 철회 시)
 *
 * ============================================================================
 */

class TokenManager {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * [Worker 전용] 데이터 수집 전 토큰 유효성 확인 및 갱신 ⭐
   *
   * @param {string} clientId - 클라이언트 UUID
   * @returns {Promise<string>} - 유효한 Access Token
   * @throws {Error} - 토큰 갱신 실패 시
   */
  async ensureValidToken(clientId) {
    console.log(`🔐 Checking token validity for client ${clientId}...`);

    // 1. 클라이언트 정보 조회
    const { data: client, error } = await this.supabase
      .from('clients')
      .select('id, client_name, token_expires_at, meta_access_token_id, meta_refresh_token_id')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      throw new Error(`Failed to fetch client: ${error?.message || 'Not found'}`);
    }

    // 2. 만료 여부 확인 (1시간 버퍼)
    const now = new Date();
    const expiresAt = new Date(client.token_expires_at);
    const oneHourFromNow = new Date(now.getTime() + 3600000);

    const isExpired = expiresAt < now;
    const isExpiringSoon = expiresAt < oneHourFromNow;

    if (!isExpired && !isExpiringSoon) {
      console.log(`✅ Token is valid for client ${client.client_name}`);
      // Vault에서 Access Token 조회 (client ID 사용)
      return await this.getAccessToken(clientId);
    }

    // 3. 토큰 갱신 필요
    if (isExpired) {
      console.log(`⚠️ Token EXPIRED for ${client.client_name}, refreshing...`);
    } else {
      console.log(`⏰ Token expiring soon for ${client.client_name}, refreshing...`);
    }

    const newAccessToken = await this.refreshToken(clientId);

    console.log(`✅ Token refreshed successfully for ${client.client_name}`);
    return newAccessToken;
  }

  /**
   * OAuth Refresh Token을 사용하여 새 Access Token 발급 ⭐
   *
   * @param {string} clientId - 클라이언트 UUID
   * @returns {Promise<string>} - 새 Access Token
   * @throws {Error} - 갱신 실패 시
   */
  async refreshToken(clientId) {
    // 1. Vault에서 Refresh Token 조회
    const { data: client } = await this.supabase
      .from('clients')
      .select('client_name, meta_refresh_token_id')
      .eq('id', clientId)
      .single();

    if (!client.meta_refresh_token_id) {
      // auth_status를 auth_required로 업데이트 ⭐
      await this.updateAuthStatus(clientId, 'auth_required');
      throw new Error(`No refresh token found for client ${clientId}`);
    }

    const refreshToken = await this.getRefreshToken(client.meta_refresh_token_id);

    if (!refreshToken) {
      // auth_status를 auth_required로 업데이트 ⭐
      await this.updateAuthStatus(clientId, 'auth_required');
      throw new Error(`Failed to retrieve refresh token from Vault`);
    }

    // 2. Meta OAuth Token Exchange
    const metaAppId = process.env.META_APP_ID;
    const metaAppSecret = process.env.META_APP_SECRET;

    if (!metaAppId || !metaAppSecret) {
      throw new Error('META_APP_ID or META_APP_SECRET not configured');
    }

    const response = await fetch(
      'https://graph.facebook.com/v22.0/oauth/access_token',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: metaAppId,
          client_secret: metaAppSecret,
          fb_exchange_token: refreshToken
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();

      // 토큰 갱신 실패 시 auth_status 업데이트 ⭐
      await this.updateAuthStatus(clientId, 'token_expired');

      throw new Error(
        `Failed to refresh token: ${errorData.error?.message || response.statusText}`
      );
    }

    const { access_token, expires_in } = await response.json();

    if (!access_token) {
      throw new Error('No access_token in Meta API response');
    }

    // 3. 새 Access Token을 Vault에 저장
    const newTokenId = await this.saveAccessToken(access_token, client.client_name);

    // 4. clients 테이블 업데이트
    const expiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString();

    await this.supabase
      .from('clients')
      .update({
        meta_access_token_id: newTokenId,
        token_expires_at: expiresAt,
        auth_status: 'active', // 갱신 성공 시 상태 복원 ⭐
        updated_at: new Date().toISOString()
      })
      .eq('id', clientId);

    // 5. 갱신 로그 저장 (모니터링용)
    await this.supabase
      .from('token_refresh_logs')
      .insert({
        client_id: clientId,
        refreshed_at: new Date().toISOString(),
        expires_at: expiresAt,
        success: true
      });

    console.log(`🔄 Token refreshed: expires in ${expires_in}s (${new Date(expiresAt).toLocaleString('ko-KR')})`);

    return access_token;
  }

  /**
   * DB에서 암호화된 Access Token 조회 후 복호화
   * 우선순위: 1) AES 암호화 토큰 → 2) Vault (fallback)
   */
  async getAccessToken(clientId) {
    if (!clientId) return null;

    try {
      // 1. DB에서 암호화된 토큰 조회
      const { data: client, error: dbError } = await this.supabase
        .from('clients')
        .select('encrypted_access_token, meta_access_token_id')
        .eq('id', clientId)
        .single();

      if (dbError) {
        console.error('Failed to fetch client:', dbError);
        return null;
      }

      // 2. AES 암호화 토큰이 있으면 복호화
      if (client?.encrypted_access_token) {
        try {
          const decryptedToken = decrypt(client.encrypted_access_token);
          if (decryptedToken) {
            console.log(`🔐 Token decrypted successfully for client ${clientId}`);
            return decryptedToken;
          }
        } catch (decryptError) {
          console.error('Decryption error:', decryptError.message);
          // 복호화 실패 시 Vault fallback 시도
        }
      }

      // 3. Fallback: Vault에서 조회 (기존 클라이언트 호환)
      if (client?.meta_access_token_id) {
        console.log(`📦 Falling back to Vault for client ${clientId}`);
        const { data: vaultToken, error: vaultError } = await this.supabase.rpc('get_client_meta_token', {
          p_client_id: clientId
        });

        if (!vaultError && vaultToken) {
          return vaultToken.replace(/\s/g, '');
        }
      }

      console.warn(`⚠️ No access token found for client ${clientId}`);
      return null;
    } catch (error) {
      console.error('Token retrieval error:', error);
      return null;
    }
  }

  /**
   * Vault에서 Refresh Token 조회
   */
  async getRefreshToken(tokenId) {
    if (!tokenId) return null;

    try {
      const { data, error } = await this.supabase.rpc('vault_read_secret', {
        secret_id: tokenId
      });

      if (error) {
        console.error('Failed to read refresh token from Vault:', error);
        return null;
      }

      // ⭐ 공백 제거 (Vault 저장 시 발생한 whitespace 처리)
      return data.secret.replace(/\s/g, '');
    } catch (error) {
      console.error('Vault read error:', error);
      return null;
    }
  }

  /**
   * 새 Access Token을 Vault에 저장
   */
  async saveAccessToken(accessToken, clientName) {
    try {
      const { data, error } = await this.supabase.rpc('vault_create_secret', {
        secret: accessToken,
        name: `meta_access_token_${clientName.replace(/\s/g, '_')}_${Date.now()}`
      });

      if (error) {
        throw new Error(`Failed to save token to Vault: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      console.error('Vault write error:', error);
      throw error;
    }
  }

  /**
   * Auth Status 업데이트 (토큰 갱신 실패 시) ⭐
   * auth_required 또는 token_expired 상태로 변경 시 즉시 텔레그램 알림 발송
   */
  async updateAuthStatus(clientId, status) {
    try {
      // 클라이언트 이름 조회
      const { data: client } = await this.supabase
        .from('clients')
        .select('client_name')
        .eq('id', clientId)
        .single();

      const clientName = client?.client_name || clientId;

      // 상태 업데이트
      await this.supabase
        .from('clients')
        .update({
          auth_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId);

      console.log(`🔐 Auth status updated to '${status}' for ${clientName}`);

      // auth_required 또는 token_expired 상태로 변경 시 즉시 알림 ⭐
      if (status === 'auth_required' || status === 'token_expired') {
        await this.sendAuthStatusAlert(clientName, status);
      }
    } catch (error) {
      console.error('Failed to update auth status:', error);
    }
  }

  /**
   * Auth 상태 변경 시 텔레그램 알림 발송 ⭐ NEW
   */
  async sendAuthStatusAlert(clientName, status) {
    const emoji = status === 'token_expired' ? '🚨' : '⚠️';
    const statusText = status === 'token_expired' ? '토큰 만료' : '재인증 필요';
    const action = status === 'token_expired'
      ? '토큰이 만료되어 데이터 수집이 중단되었습니다. Meta 재인증이 필요합니다.'
      : 'Meta 계정 재인증이 필요합니다. 토큰 갱신에 실패했습니다.';

    const message = `${emoji} <b>${clientName} - ${statusText}</b>

📋 <b>상태</b>: ${status}
⏰ <b>발생 시각</b>: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST

📝 <b>필요 조치</b>:
${action}

━━━━━━━━━━━━━━━━━━━━
🔗 재인증 진행: 대시보드에서 Meta 연동 페이지로 이동`;

    await sendAdminAlert(`${emoji} Auth Alert: ${clientName}`, message);
  }

  /**
   * [모니터링 전용] 만료 예정 토큰 조회 및 Admin 알림
   *
   * 이 함수는 pg_cron에서 매일 실행됩니다.
   * Worker의 ensureValidToken()과는 독립적으로 동작합니다.
   */
  static async monitorExpiringTokens(supabase) {
    console.log('🔍 Monitoring expiring tokens...');

    // SQL 함수 호출
    const { data: expiringTokens, error } = await supabase.rpc('check_expiring_tokens');

    if (error) {
      console.error('Failed to check expiring tokens:', error);
      return;
    }

    if (expiringTokens.length === 0) {
      console.log('✅ All tokens are valid (>7 days until expiry)');
      return;
    }

    // Admin 알림 메시지 생성
    let alertMessage = `⚠️ Token Expiry Alert\n\n${expiringTokens.length} token(s) expiring within 7 days:\n\n`;

    expiringTokens.forEach((token) => {
      const daysLeft = Math.floor(token.days_until_expiry);
      alertMessage += `• ${token.client_name}: ${daysLeft} day(s) left\n`;
      alertMessage += `  Expires: ${new Date(token.token_expires_at).toLocaleString('ko-KR')}\n\n`;
    });

    alertMessage += `ℹ️ Note: Worker will automatically refresh tokens 1 hour before expiry.\n`;
    alertMessage += `This alert is a safety check for tokens that may need manual intervention.`;

    console.log(alertMessage);

    // Telegram Admin 알림
    await sendAdminAlert('🔐 Token Expiry Warning', alertMessage);
  }
}

/**
 * Telegram Admin 알림 함수
 */
async function sendAdminAlert(title, message) {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!telegramBotToken || !adminChatId) {
    console.log('⚠️ Telegram credentials not set, skipping admin alert');
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: `<b>${title}</b>\n\n${message}`,
          parse_mode: 'HTML'
        })
      }
    );

    if (response.ok) {
      console.log('✅ Admin alert sent via Telegram');
    } else {
      const error = await response.json();
      console.error('Failed to send Telegram alert:', error);
    }
  } catch (error) {
    console.error('Telegram API error:', error.message);
  }
}

module.exports = {
  TokenManager,
  sendAdminAlert
};
