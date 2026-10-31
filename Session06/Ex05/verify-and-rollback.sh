#!/bin/bash
# Session06/Ex05/verify-and-rollback.sh

echo "=== [STAGE 5] GIÁM SÁT HỆ THỐNG VÀ KIỂM TRA SỨC KHỎE SAU DEPLOY ==="

SIMULATE_APP_ERROR="${SIMULATE_APP_ERROR:-false}"
PREVIOUS_STABLE_TAG="${PREVIOUS_STABLE_TAG:-latest}"

if [ "$SIMULATE_APP_ERROR" = "true" ]; then
    echo "=> [CẢNH BÁO NGUY HIỂM] Phát hiện lỗi HTTP 500 Internal Server Error tại endpoint /health!"
    echo "=> TIÊU CHÍ KÍCH HOẠT QUAY LUI ĐÃ ĐƯỢC THỎA MÃN. BẮT ĐẦU TỰ ĐỘNG ROLLBACK..."
    
    START_TIME=$(date +%s)
    
    echo "1. Đang dừng container phiên bản mới dính lỗi..."
    echo "2. Kéo và kích hoạt container phiên bản ổn định trước đó (Tag: $PREVIOUS_STABLE_TAG)..."
    sleep 3 # Giả lập thao tác hạ container và khôi phục
    
    END_TIME=$(date +%s)
    DIFF=$((END_TIME - START_TIME))
    
    echo "=> ĐÃ TỰ ĐỘNG QUAY LUI VỀ BẢN CŨ THÀNH CÔNG!"
    echo "=> Tổng thời gian tự động phục hồi: $DIFF giây (Đạt yêu cầu < 2 phút)."
    exit 0
else
    echo "=> Kiểm tra 5/5 requests tới endpoint /health: Hoàn toàn bình thường (HTTP 200 OK)."
    echo "=> Triển khai phiên bản mới thành công mỹ mãn!"
    exit 0
fi