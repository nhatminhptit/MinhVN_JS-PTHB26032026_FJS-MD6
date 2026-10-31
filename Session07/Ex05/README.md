# Báo cáo: Nền tảng quản trị truy cập cloud cho ShopFast

## 1. Sơ đồ mô hình phân quyền và luồng đánh giá yêu cầu
```text
[Yêu cầu gọi AWS API]
         │
         ▼
[Kiểm tra Explicit Deny] ────(Phát hiện Deny / Thiếu MFA)────► [TỪ CHỐI NGAY LẬP TỨC]
         │
         ▼ (Không có Deny)
[Kiểm tra Explicit Allow] ───(Khớp vai trò và tài nguyên)───► [CHO PHÉP THỰC THI]
         │
         ▼ (Không khớp)
[Mặc định từ chối (Implicit Deny)]