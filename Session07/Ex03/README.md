# Báo cáo: Thiết lập quản trị truy cập cho đội ShopFast mở rộng

## PHẦN A: MA TRẬN PHÂN QUYỀN VÀ GIẢI PHÁP THIẾT KẾ

### 1. Ma trận phân quyền 5 vai trò
| Vai trò | Dịch vụ được truy cập | Hành động được phép | Phạm vi tài nguyên | Điều kiện bổ sung |
| :--- | :--- | :--- | :--- | :--- |
| **Backend Dev (6 người)** | S3, EC2 | Đọc/Ghi môi trường Dev; Chỉ đọc môi trường Prod | S3 dev/prod buckets, EC2 dev instances | Cấm tuyệt đối quyền ghi/xóa trên tài nguyên có tiền tố prod |
| **DevOps / SysAdmin (3 người)** | S3, EC2, RDS, VPC | Toàn quyền cấu hình, khởi tạo, bảo trì hạ tầng | Toàn bộ tài nguyên trên cả hai môi trường | Thao tác XÓA tài nguyên prod bắt buộc phải có MFA trong phiên |
| **Data Engineer (2 người)** | S3 | Đọc đối tượng và danh sách bucket phân tích | `arn:aws:s3:::shopfast-analytics-data*` | Mặc định từ chối (Implicit Deny) với tất cả các dịch vụ khác |
| **Kế toán (1 người)** | AWS Billing, Budgets, Cost Explorer | Xem hóa đơn, báo cáo chi phí, theo dõi hạn mức | Toàn bộ tài khoản | Chỉ cấp quyền `ViewBilling` và `ViewBudget`, không can thiệp hạ tầng |
| **Đối tác bên ngoài (3 người)** | CloudWatch Logs | Đọc và lọc sự kiện log của dịch vụ thanh toán | `log-group:/shopfast/payment-service:*` | Tự động hết hạn sau 90 ngày (`DateLessThan: aws:CurrentTime`) |

### 2. Kiến trúc nhóm và giải pháp quản trị
- **Tổ chức 4 IAM Groups cho nội bộ:** `ShopFast-Backend-Group`, `ShopFast-DevOps-Group`, `ShopFast-Data-Group`, `ShopFast-Billing-Group`. Gắn chính sách tương ứng vào Group, tuyệt đối không gán trực tiếp vào từng cá nhân.
- **Sử dụng IAM Role cho đối tác bên ngoài:** Đối tác được cấp quyền qua IAM Role với thời hạn tối đa 90 ngày (Session ngắn hạn), không cấp tài khoản người dùng cố định hay Access Key dài hạn.
- **Bật CloudTrail đa vùng:** Kích hoạt AWS CloudTrail tại tất cả các khu vực (All Regions) để ghi lại toàn bộ lịch sử gọi API phục vụ công tác truy vết trách nhiệm.

### 3. Quy trình cấp quyền và thu hồi quyền (< 5 phút)
- **Quy trình cấp quyền mới (Onboarding):**
  1. Tạo IAM User tương ứng với email công việc của nhân viên (không tạo Access Key lập trình).
  2. Thêm nhân viên vào đúng IAM Group theo vai trò.
  3. Bắt buộc nhân viên thiết lập mật khẩu mới và kích hoạt xác thực hai lớp (MFA) ngay trong lần đăng nhập đầu tiên.
- **Quy trình thu hồi toàn bộ quyền khi nghỉ việc (< 5 phút) (Offboarding Runbook):**
  1. Chuyển trạng thái đăng nhập console sang **Disabled** và xóa toàn bộ Access Key (nếu có) trên IAM Console (Thao tác: 30 giây).
  2. Xóa người dùng ra khỏi toàn bộ các IAM Group (Thao tác: 30 giây).
  3. Gắn trực tiếp chính sách `AWSRevokeOlderSessions` để lập tức hủy bỏ các phiên đăng nhập đang hoạt động (Thao tác: 45 giây).
  4. Thu hồi các Role mà người này được phép Assume (Thao tác: 30 giây).
  *=> Tổng thời gian hoàn tất: ~2 phút 15 giây (Đạt yêu cầu dưới 5 phút).*

---

## PHẦN B: KẾT QUẢ MÔ PHỎNG 8 TÌNH HUỐNG & GIẢI QUYẾT BẪY DỮ LIỆU

### 1. Bảng kết quả 8 tình huống thử nghiệm
1. **Backend Dev đọc/ghi Dev:** ALLOW (Đúng phạm vi phát triển).
2. **Backend Dev đọc Prod:** ALLOW (Cho phép đọc để tra cứu sự cố).
3. **Backend Dev ghi/xóa Prod:** DENY (Chặn đứng theo chính sách DenyWriteProdAccess).
4. **DevOps xóa Prod CÓ MFA:** ALLOW (Thỏa mãn điều kiện an toàn).
5. **DevOps xóa Prod KHÔNG CÓ MFA:** DENY (Chặn do thiếu điều kiện MFA).
6. **Data Engineer truy cập EC2:** DENY (Từ chối ngầm - Implicit Deny).
7. **Đối tác truy cập log sau 90 ngày:** DENY (Chính sách tự động hết hiệu lực do vượt quá mốc thời gian quy định).
8. **Quyền mâu thuẫn (Vừa Allow vừa Deny cùng tài nguyên):** DENY (Áp dụng quy tắc cốt lõi của AWS IAM: **Từ chối tường minh luôn thắng - Explicit Deny Always Wins**).