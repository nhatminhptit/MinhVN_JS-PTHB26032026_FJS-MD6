# Báo cáo: Vá lỗi chính sách IAM cấp quyền quá rộng

## Phần 1: 4 khiếm khuyết trong chính sách cũ và tình huống khai thác

1. **Cặp ký tự đại diện `Action: "s3:*"` và `Resource: "*"`:** Cấp toàn quyền trên toàn bộ S3. Lập trình viên vô tình gọi lệnh xóa nhầm bucket chứa sao lưu cơ sở dữ liệu sản xuất `shopfast-prod-backup-db`.
2. **Cấp quyền quản trị `Action: ["iam:*"]`:** Cấp quyền quản lý truy cập. Lập trình viên hoặc kẻ xấu có thể tự cấp quyền `AdministratorAccess` cho tài khoản của mình mà không cần ai phê duyệt.
3. **Cấp toàn quyền máy chủ `Action: ["ec2:*"]` thay vì chỉ xem:** Cho phép thực thi lệnh `ec2:StopInstances` hoặc `ec2:TerminateInstances`, làm sập toàn bộ máy chủ API đang chạy thật.
4. **Không giới hạn phạm vi tiền tố bucket:** Không ràng buộc tiền tố `shopfast-dev-`, làm lộ toàn bộ dữ liệu nội bộ và mã nguồn lưu ở các bucket khác.

## Phần 2: Kết quả mô phỏng 4 tình huống kiểm thử

| Tình huống                 | Hành động                | Tài nguyên mục tiêu                          |  Kết quả  | Đánh giá                         |
| :------------------------- | :----------------------- | :------------------------------------------- | :-------: | :------------------------------- |
| **1. Đọc/ghi bucket dev**  | `s3:PutObject`           | `arn:aws:s3:::shopfast-dev-bucket/image.png` | **ALLOW** | Cho phép theo đúng phạm vi dev   |
| **2. Xóa bucket prod**     | `s3:DeleteBucket`        | `arn:aws:s3:::shopfast-prod-backup-db`       | **DENY**  | Chặn tự động do không có quyền   |
| **3. Can thiệp quyền IAM** | `iam:AttachUserPolicy`   | `arn:aws:iam::*:user/*`                      | **DENY**  | Chặn đứng bởi khối Deny `iam:*`  |
| **4. Xóa máy chủ EC2**     | `ec2:TerminateInstances` | `arn:aws:ec2:*:*:instance/*`                 | **DENY**  | Chặn đứng bởi khối Deny phá hoại |
