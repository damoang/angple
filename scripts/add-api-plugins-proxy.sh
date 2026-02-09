#!/bin/bash
# /etc/nginx/conf.d/damoang.conf에 /api/plugins/ 프록시 추가
# admin.damoang.net, web.damoang.net, dev.damoang.net 모두에 적용

CONF="/etc/nginx/conf.d/damoang.conf"
BACKUP="${CONF}.bak.$(date +%Y%m%d_%H%M%S)"

# 이미 추가되어 있는지 확인
if grep -q "location /api/plugins/" "$CONF"; then
    echo "✅ /api/plugins/ 프록시가 이미 설정되어 있습니다."
    exit 0
fi

echo "📋 백업: $BACKUP"
sudo cp "$CONF" "$BACKUP"

# Python으로 정확하게 삽입
sudo python3 -c "
import re

with open('$CONF', 'r') as f:
    content = f.read()

proxy_block = '''
    # Go Backend Plugin API (이모티콘 이미지 등)
    location /api/plugins/ {
        proxy_pass http://127.0.0.1:8082/api/plugins/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Cookie \$http_cookie;
    }
'''

# 각 server 블록의 'location / {' 앞에 프록시 블록 삽입
# SvelteKit 프록시로 가기 전에 /api/plugins/ 를 먼저 매칭하도록
result = content.replace(
    '    # SvelteKit Dev (포트 3011)\n    location / {',
    proxy_block + '\n    # SvelteKit Dev (포트 3011)\n    location / {'
)

# admin.damoang.net 블록 (첫 번째 location / { 앞에)
# WebSocket support 위의 location / 을 찾아서 삽입
result = result.replace(
    '    location / {\n        proxy_pass http://127.0.0.1:3011/;\n        proxy_set_header Host \$host;\n        proxy_set_header X-Real-IP \$remote_addr;\n        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \$scheme;\n        proxy_set_header Cookie \$http_cookie;\n\n        # WebSocket support for dev server',
    proxy_block + '\n    location / {\n        proxy_pass http://127.0.0.1:3011/;\n        proxy_set_header Host \$host;\n        proxy_set_header X-Real-IP \$remote_addr;\n        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \$scheme;\n        proxy_set_header Cookie \$http_cookie;\n\n        # WebSocket support for dev server',
    1  # 첫번째만
)

# web.damoang.net 블록 - /api/v1/ 뒤, location / 앞에
result = result.replace(
    '    # JSON 데이터 서빙 (ETag + 5분 캐시)',
    proxy_block + '\n    # JSON 데이터 서빙 (ETag + 5분 캐시)',
    1
)

with open('$CONF', 'w') as f:
    f.write(result)

print('✅ /api/plugins/ 프록시 블록 추가 완료')
"

echo "🔍 nginx 설정 테스트..."
sudo nginx -t && {
    echo "🔄 nginx 리로드..."
    sudo systemctl reload nginx
    echo "✅ 완료!"
} || {
    echo "❌ nginx 설정 오류! 백업 복원..."
    sudo cp "$BACKUP" "$CONF"
    echo "복원 완료. 수동으로 확인해주세요."
}
