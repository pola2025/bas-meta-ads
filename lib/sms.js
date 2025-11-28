/**
 * 네이버 클라우드 SENS SMS 발송 라이브러리
 *
 * 환경변수 필요:
 *   NCP_ACCESS_KEY
 *   NCP_SECRET_KEY
 *   NCP_SERVICE_ID
 *   NCP_SENDER_PHONE
 */

const crypto = require('crypto');
const fetch = require('node-fetch');

class SMSClient {
  constructor(options = {}) {
    this.accessKey = options.accessKey || process.env.NCP_ACCESS_KEY;
    this.secretKey = options.secretKey || process.env.NCP_SECRET_KEY;
    this.serviceId = options.serviceId || process.env.NCP_SERVICE_ID;
    this.senderPhone = options.senderPhone || process.env.NCP_SENDER_PHONE;

    if (!this.accessKey || !this.secretKey || !this.serviceId || !this.senderPhone) {
      throw new Error('NCP SENS 환경변수가 설정되지 않았습니다.');
    }
  }

  /**
   * HMAC-SHA256 서명 생성
   */
  makeSignature(timestamp, method, url) {
    const space = ' ';
    const newLine = '\n';

    const message = [
      method,
      space,
      url,
      newLine,
      timestamp,
      newLine,
      this.accessKey
    ].join('');

    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(message);
    return hmac.digest('base64');
  }

  /**
   * SMS 발송
   * @param {string} to - 수신자 전화번호 (01012345678)
   * @param {string} content - 메시지 내용
   * @param {string} type - SMS(90byte) 또는 LMS(2000byte)
   */
  async send(to, content, type = 'LMS') {
    const timestamp = Date.now().toString();
    const uri = `/sms/v2/services/${this.serviceId}/messages`;
    const url = `https://sens.apigw.ntruss.com${uri}`;

    // 전화번호 정규화 (- 제거)
    const normalizedPhone = to.replace(/-/g, '');

    const body = {
      type: type,
      from: this.senderPhone.replace(/-/g, ''),
      content: content,
      messages: [
        { to: normalizedPhone }
      ]
    };

    const signature = this.makeSignature(timestamp, 'POST', uri);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': this.accessKey,
          'x-ncp-apigw-signature-v2': signature
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (response.ok && result.statusCode === '202') {
        return {
          success: true,
          requestId: result.requestId,
          statusCode: result.statusCode
        };
      } else {
        return {
          success: false,
          error: result.statusMessage || result.error || 'Unknown error',
          statusCode: result.statusCode
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 여러 번호로 동시 발송
   */
  async sendBulk(phones, content, type = 'LMS') {
    const timestamp = Date.now().toString();
    const uri = `/sms/v2/services/${this.serviceId}/messages`;
    const url = `https://sens.apigw.ntruss.com${uri}`;

    const messages = phones.map(phone => ({
      to: phone.replace(/-/g, '')
    }));

    const body = {
      type: type,
      from: this.senderPhone.replace(/-/g, ''),
      content: content,
      messages: messages
    };

    const signature = this.makeSignature(timestamp, 'POST', uri);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': this.accessKey,
          'x-ncp-apigw-signature-v2': signature
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (response.ok && result.statusCode === '202') {
        return {
          success: true,
          requestId: result.requestId,
          statusCode: result.statusCode,
          count: phones.length
        };
      } else {
        return {
          success: false,
          error: result.statusMessage || result.error || 'Unknown error',
          statusCode: result.statusCode
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SMSClient;
