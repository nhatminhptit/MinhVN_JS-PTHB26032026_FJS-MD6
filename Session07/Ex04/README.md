# Báo cáo: Chọn cơ chế xác thực cho ứng dụng ShopFast chạy trên máy chủ

## PHẦN A: PHÂN TÍCH & ĐỀ XUẤT ĐA GIẢI PHÁP

### 1. Phân tích đầu vào, đầu ra và các vị trí cần xác thực
* **Vị trí 1 - Ứng dụng chính trên Cloud (EC2):** Cần quyền ghi hóa đơn PDF vào S3 (`s3:PutObject`) và đọc chuỗi kết nối cơ sở dữ liệu từ AWS Secrets Manager (`secretsmanager:GetSecretValue`)[cite: 46].
* **Vị trí 2 - Máy lập trình viên (Local):** Cần ghi vào S3 bucket môi trường Dev để kiểm thử tính năng xuất PDF[cite: 46, 47].
* **Vị trí 3 - Tác vụ định kỳ ngoài Cloud (On-Premise):** Cần đẩy các file báo cáo/hóa đơn tồn đọng lên S3, không có máy chủ AWS để gắn Instance Profile trực tiếp[cite: 46, 47].

### 2. Các giải pháp khả thi được đề xuất
* **Giải pháp 1: Khóa truy cập dài hạn (Access Keys) trong biến môi trường (`.env`).**[cite: 46]
  * *Nguyên lý:* Tạo IAM User, sinh Access Key ID & Secret Access Key rồi đặt vào biến môi trường trên máy chủ[cite: 34, 46].
* **Giải pháp 2: Gắn IAM Role trực tiếp vào máy chủ (Instance Profile).**[cite: 46]
  * *Nguyên lý:* Gắn IAM Role vào máy chủ EC2. Ứng dụng tự động lấy thông tin xác thực tạm thời từ AWS Instance Metadata Service (IMDSv2) mà không cần lưu khóa nào trên đĩa[cite: 34, 41, 46].
* **Giải pháp 3 (Tối ưu nhất): Kết hợp IAM Role (Cloud) + AWS Secrets Manager + IAM Roles Anywhere (Ngoài Cloud).**[cite: 46]
  * *Nguyên lý:* Sử dụng IAM Role cho máy chủ EC2 để ứng dụng có quyền lấy chuỗi kết nối DB từ Secrets Manager[cite: 46]; máy chủ ngoài Cloud dùng IAM Roles Anywhere (chứng chỉ X.509) để lấy Token tạm thời từ AWS STS[cite: 46, 47].

---

## PHẦN B: BẢNG SO SÁNH & BIỆN LUẬN LỰA CHỌN

### 1. Bảng so sánh 4 tiêu chí cốt lõi
| Tiêu chí đánh giá[cite: 46] | Giải pháp 1: Khóa dài hạn (Access Key)[cite: 41, 46] | Giải pháp 2: IAM Role thuần túy[cite: 41, 46] | Giải pháp 3: Kết hợp IAM Role + Secrets Manager + Roles Anywhere[cite: 41, 46, 47] |
| :--- | :--- | :--- | :--- |
| **1. Mức độ thiệt hại khi máy chủ bị xâm nhập**[cite: 46] | **RẤT CAO:** Kẻ xấu lấy trộm khóa vĩnh viễn, khai thác cho đến khi bị phát hiện[cite: 30, 41, 46]. | **THẤP:** Token tạm thời chỉ sống tối đa vài giờ rồi tự hủy[cite: 41, 46]. | **CỰC THẤP:** Token tạm thời tự hủy; mật khẩu CSDL nằm trong Secrets Manager có kiểm soát chặt chẽ[cite: 41, 46]. |
| **2. Công sức xoay vòng thông tin xác thực**[cite: 46] | **RẤT TỐN CÔNG:** Phải đổi thủ công định kỳ 90 ngày, dễ gây sập web khi đổi[cite: 41, 44, 46]. | **BẰNG 0:** AWS tự động xoay vòng token mỗi 6 giờ trong nền (Zero-downtime)[cite: 41, 46]. | **BẰNG 0:** Cả IAM Role và Secrets Manager đều hỗ trợ tự động xoay vòng hoàn toàn tự động[cite: 41, 46]. |
| **3. Khả năng dùng chung cho môi trường phát triển (Local)**[cite: 46] | Dễ nhưng dễ làm lộ khóa dev lên kho mã nguồn Git[cite: 30, 46, 47]. | Không thể gắn trực tiếp Instance Profile trên laptop[cite: 46, 47]. | **XUẤT SẮC:** Dùng cơ chế Default Credential Provider Chain (Local dùng Profile dev, Prod dùng Role)[cite: 41, 46, 47]. |
| **4. Chi phí & Độ phức tạp vận hành (3 kỹ sư)**[cite: 46] | Thấp ban đầu nhưng chi phí bảo trì rủi ro cực lớn[cite: 30, 46]. | Cực thấp, cấu hình 1 lần là xong[cite: 41, 46]. | **TỐI ƯU:** Chi phí Secrets Manager rất nhỏ (~$0.40/tháng), tự động hóa 100% giúp giảm tải tối đa cho đội 3 kỹ sư[cite: 46]. |

### 2. Biện luận chốt giải pháp cho đội ngũ 3 kỹ sư vận hành
* **Lựa chọn:** **Giải pháp 3 (Kết hợp IAM Role + Secrets Manager + IAM Roles Anywhere)**[cite: 46, 47].
* **Căn cứ:**
  1. *Giải phóng nhân lực:* Đội chỉ có 3 kỹ sư, không thể phân công người nhớ lịch để xoay vòng khóa thủ công hay giải quyết sự cố lộ khóa lúc nửa đêm[cite: 41, 46]. Giải pháp này tự động xoay vòng 100% qua AWS SDK[cite: 41, 46].
  2. *Bảo vệ CSDL:* Không để mật khẩu database dạng text trong file `.env`, tránh nguy cơ rò rỉ khi ứng dụng bị đọc trộm file cấu hình[cite: 23, 46].

---

## PHẦN C: THIẾT KẾ & TRIỂN KHAI XỬ LÝ 2 BẪY DỮ LIỆU

### 1. Xử lý Bẫy 1: Ứng dụng chạy trên máy cá nhân của lập trình viên (Local Development)[cite: 46, 47]
* Lập trình viên không có IAM Instance Profile trên máy tính[cite: 46, 47].
* **Giải pháp:** Sử dụng **Default Credential Provider Chain** của AWS SDK. Trên máy cá nhân, lập trình viên cấu hình tài khoản qua AWS CLI (`aws configure`) gắn vào tài khoản Sandbox môi trường Dev. Mã nguồn ứng dụng hoàn toàn không sửa đổi, SDK sẽ tự nhận diện Profile máy cục bộ[cite: 47].

### 2. Xử lý Bẫy 2: Tác vụ định kỳ chạy trên máy chủ ngoài Cloud (On-Premise Server)[cite: 46, 47]
* Máy chủ ngoài cloud không thể gắn IAM Role trực tiếp[cite: 46, 47].
* **Giải pháp:** Dùng **AWS IAM Roles Anywhere**[cite: 47]. Cài đặt chứng chỉ số X.509 hợp lệ lên máy chủ ngoài cloud[cite: 47]. Mỗi khi chạy tác vụ định kỳ, script sử dụng chứng chỉ này gọi dịch vụ AWS STS để xin một **Security Token tạm thời có hạn 1 giờ**[cite: 41, 47]. Tuyệt đối không lưu Access Key vĩnh viễn trên máy chủ ngoài cloud[cite: 41, 47].