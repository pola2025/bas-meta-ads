"""
텔레그램 주간 리포트 전송
"""

import os
import asyncio
from telegram import Bot
from telegram.constants import ParseMode

async def send_weekly_report(client_name, summary, insights, chart_path):
    """
    주간 리포트를 텔레그램으로 전송
    
    Args:
        client_name (str): 클라이언트 이름
        summary (dict): KPI 요약 데이터
        insights (str): 인사이트 텍스트
        chart_path (str): 차트 이미지 경로
    
    Returns:
        bool: 전송 성공 여부
    """
    try:
        bot = Bot(token=os.getenv('TELEGRAM_BOT_TOKEN'))
        chat_id = os.getenv('TELEGRAM_ADMIN_CHAT_ID')
        
        # 메시지 포맷
        message = f"""
📊 **[BAS] {client_name} 주간 리포트**
기간: {summary['period_start']} ~ {summary['period_end']}

**📈 핵심 성과 요약**
• 지출: ${summary['spend']:,.2f} ({summary['spend_change']:+.1f}%)
• 리드: {summary['leads']:,}건 ({summary['leads_change']:+.1f}%)
• CPL: ${summary['cpl']:,.2f}
• CTR: {summary['ctr']:.2f}%

**💡 인사이트**
{insights}

---
🤖 BAS Meta Ads Analytics
"""
        
        # 텍스트 메시지 전송
        await bot.send_message(
            chat_id=chat_id,
            text=message,
            parse_mode=ParseMode.MARKDOWN
        )
        
        # 차트 이미지 전송
        if chart_path and os.path.exists(chart_path):
            with open(chart_path, 'rb') as photo:
                await bot.send_photo(
                    chat_id=chat_id,
                    photo=photo,
                    caption=f"{client_name} - 주간 성과 추이"
                )
        
        print(f"✅ Telegram report sent successfully to {chat_id}")
        return True
        
    except Exception as error:
        print(f"❌ Failed to send Telegram report: {error}")
        return False

def send_report_sync(client_name, summary, insights, chart_path):
    """
    동기 방식으로 리포트 전송 (Node.js에서 호출 가능)
    """
    return asyncio.run(send_weekly_report(client_name, summary, insights, chart_path))
