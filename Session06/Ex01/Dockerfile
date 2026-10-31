# ==============================================================================
# GIAI ĐOẠN 1: TẦNG BUILD (Biên dịch TypeScript sang JavaScript)
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Sao chép khai báo phụ thuộc trước để tận dụng Docker layer cache
COPY package*.json ./

# 2. Cài đặt toàn bộ thư viện (bao gồm devDependencies để có tsc biên dịch)
RUN npm ci

# 3. Sao chép toàn bộ mã nguồn sau
COPY . .

# 4. Biên dịch mã TypeScript ra thư mục dist
RUN npm run build

# ==============================================================================
# GIAI ĐOẠN 2: TẦNG RUNNER (Môi trường chạy thực tế - Gọn nhẹ & An toàn)
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Thiết lập môi trường sản xuất
ENV NODE_ENV=production

# 1. Tạo người dùng và nhóm không có quyền quản trị (Non-root user)
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

# 2. Chỉ cài đặt các thư viện phục vụ chạy thực tế (loại bỏ devDependencies)
COPY package*.json ./
RUN npm ci --omit=dev

# 3. Chỉ lấy duy nhất thư mục dist đã biên dịch từ tầng builder sang
COPY --from=builder /app/dist ./dist

# 4. Phân quyền sở hữu thư mục ứng dụng cho người dùng nodejs
RUN chown -R nodejs:nodejs /app

# 5. Chuyển sang chạy bằng tài khoản không có quyền root
USER nodejs

# 6. Mở cổng ứng dụng
EXPOSE 3000

# 7. Kiểm tra trạng thái sức khỏe định kỳ của container
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# 8. Lệnh khởi chạy của môi trường thật (chạy trực tiếp bằng node)
CMD ["node", "dist/main.js"]