# Báo cáo: Điền khuyết Role cho pipeline CI/CD

## 1. Hoàn thiện 5 chỗ khuyết
- **Chỗ khuyết (1):** Thêm khối `Condition` vào `trust-policy.json`[cite: 41, 42].
- **Chỗ khuyết (2):** Thêm điều kiện `aud: sts.amazonaws.com` để đảm bảo token được cấp từ AWS STS[cite: 35, 41, 42].
- **Chỗ khuyết (3) & (4):** Thêm điều kiện `sub: repo:shopfast/backend:ref:refs/heads/main` giới hạn duy nhất tổ chức `shopfast`, kho mã `backend` và nhánh `main`[cite: 35, 41, 42].
- **Chỗ khuyết (5):** Viết tệp chính sách `ecr-push-policy.json` cấp quyền tối thiểu (`ecr:PutImage`, `ecr:InitiateLayerUpload`,...) trên đúng tài nguyên kho lưu trữ mục tiêu, tuyệt đối không dùng `ecr:*`[cite: 33, 36, 42].

## 2. Giải pháp chống bẫy dữ liệu
- Không dùng phép so sánh `StringLike` với tiền tố dấu sao `*shopfast/backend*` vì kẻ xấu có thể tạo tổ chức tên `hacker-shopfast/backend` để lách qua[cite: 35, 42].
- Sử dụng điều kiện `StringEquals` neo chặt toàn bộ chuỗi từ ký tự đầu tiên: `repo:shopfast/backend:ref:refs/heads/main`[cite: 35, 42].