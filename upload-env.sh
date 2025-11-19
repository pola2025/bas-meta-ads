#!/bin/bash

# Railway 환경 변수 업로드 스크립트
echo "🚀 Uploading environment variables to Railway..."
echo ""

# MODE 변수 추가 (worker 모드)
echo "📝 Setting MODE=worker"
railway variables --set "MODE=worker"

# .env 파일 읽기
count=0
while IFS= read -r line || [ -n "$line" ]; do
  # 주석과 빈 줄 제외
  if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
    # KEY=VALUE 형식 확인
    if [[ "$line" =~ = ]]; then
      key=$(echo "$line" | cut -d '=' -f 1)
      echo "📝 Setting $key"
      railway variables --set "$line"
      count=$((count + 1))
    fi
  fi
done < .env

echo ""
echo "✅ Uploaded $count environment variables to Railway"
echo "🔄 Railway will automatically redeploy your service"
