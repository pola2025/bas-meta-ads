/**
 * 작업 로그 모듈
 *
 * 모든 CLI 작업을 날짜별 파일로 기록
 * logs/YYYY-MM-DD.log
 */

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

// logs 폴더 생성
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * 로그 기록
 * @param {string} action - 작업 유형 (ADD_CLIENT, BACKFILL, STATUS 등)
 * @param {string} message - 로그 메시지
 * @param {string} status - SUCCESS, FAILED, INFO
 */
function log(action, message, status = 'INFO') {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0];

  const logLine = `[${date} ${time}] ${action}: ${message} - ${status}\n`;
  const logFile = path.join(LOGS_DIR, `${date}.log`);

  // 파일에 추가
  fs.appendFileSync(logFile, logLine);

  // 콘솔에도 출력 (색상)
  const colors = {
    SUCCESS: '\x1b[32m', // 녹색
    FAILED: '\x1b[31m',  // 빨간색
    INFO: '\x1b[36m',    // 청록색
    WARN: '\x1b[33m'     // 노란색
  };
  const reset = '\x1b[0m';
  const color = colors[status] || colors.INFO;

  console.log(`${color}[${time}] ${action}: ${message} - ${status}${reset}`);
}

/**
 * 성공 로그
 */
function success(action, message) {
  log(action, message, 'SUCCESS');
}

/**
 * 실패 로그
 */
function fail(action, message) {
  log(action, message, 'FAILED');
}

/**
 * 정보 로그
 */
function info(action, message) {
  log(action, message, 'INFO');
}

/**
 * 경고 로그
 */
function warn(action, message) {
  log(action, message, 'WARN');
}

module.exports = { log, success, fail, info, warn };
