#!/bin/bash
# Session07/Ex05/runbooks/onboarding.sh
USERNAME=$1
ROLE_GROUP=$2

if [ -z "$USERNAME" ] \vert{}\vert{} [ -z "$ROLE_GROUP" ]; then
  echo "Usage: ./onboarding.sh <username> <group-name>"
  exit 1
fi

echo "[ONBOARDING] Bắt đầu cấp quyền cho nhân viên mới: $USERNAME"
echo "1. Tạo IAM User không cấp Access Key lập trình..."
echo "aws iam create-user --user-name $USERNAME"
echo "2. Bắt buộc kích hoạt MFA và tạo mật khẩu tạm thời cho lần đăng nhập đầu tiên..."
echo "aws iam create-login-profile --user-name $USERNAME --password-reset-required"
echo "3. Gán user vào đúng IAM Group theo vai trò: $ROLE_GROUP..."
echo "aws iam add-user-to-group --user-name $USERNAME --group-name$ROLE_GROUP"
echo "=> Cấp quyền thành công cho $USERNAME. Ranh giới an toàn được thiết lập."