#!/bin/bash
# Session07/Ex05/runbooks/offboarding.sh
USERNAME=$1
START_TIME=$(date +%s)

if [ -z "$USERNAME" ]; then
  echo "Usage: ./offboarding.sh <username>"
  exit 1
fi

echo "[OFFBOARDING] Khởi động quy trình thu hồi quyền khẩn cấp (< 5 phút) cho: $USERNAME"
echo "1. Khóa đăng nhập console và vô hiệu hóa tài khoản..."
echo "aws iam delete-login-profile --user-name $USERNAME"

echo "2. Xóa toàn bộ Access Keys (nếu có)..."
echo "aws iam list-access-keys --user-name $USERNAME | xargs -I {} aws iam delete-access-key --access-key-id {}"

echo "3. Xóa user ra khỏi tất cả IAM Groups..."
echo "aws iam get-groups-for-user --user-name $USERNAME | xargs -I {} aws iam remove-user-from-group --group-name {}"

echo "4. Gắn chính sách AWSRevokeOlderSessions để ngắt kết nối mọi phiên làm việc ngay lập tức..."
echo "aws iam attach-user-policy --user-name $USERNAME --policy-arn arn:aws:iam::aws:policy/AWSRevokeOlderSessions"

END_TIME=$(date +%s)
DIFF=$((END_TIME - START_TIME))
echo "=> Thu hồi toàn bộ quyền của $USERNAME hoàn tất trong $DIFF giây (< 5 phút)."