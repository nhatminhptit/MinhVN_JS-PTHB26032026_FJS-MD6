const { getCredentials, runApplicationTask } = require("./app-auth");

console.log(
  "===================================================================",
);
console.log("KIỂM ĐỊNH CƠ CHẾ XÁC THỰC ỨNG DỤNG SHOPFAST (SESSION 07 - EX04)");
console.log(
  "===================================================================\n",
);

let pass = 0;
const total = 4;

// 1. Kiểm tra môi trường Cloud Production (Dùng Role gắn vào máy chủ)
console.log("[Kiểm tra 1] Ứng dụng chạy trên máy chủ Cloud (EC2 Production):");
const prodCreds = getCredentials("production");
if (
  prodCreds.type === "EC2_INSTANCE_PROFILE_ROLE" &&
  prodCreds.temporary === true
) {
  console.log(
    "✔ PASS: Sử dụng IAM Instance Profile, thông tin xác thực tạm thời, tự động xoay vòng.\n",
  );
  pass++;
} else {
  console.error("✖ FAIL: Chưa áp dụng IAM Role cho máy chủ cloud!\n");
}

// 2. Bẫy dữ liệu 1: Môi trường phát triển cục bộ của lập trình viên
console.log(
  "[Kiểm tra 2] Bẫy 1 - Máy cá nhân lập trình viên (Local Development):",
);
const localCreds = getCredentials("local");
if (
  localCreds.type === "LOCAL_DEV_PROFILE" &&
  localCreds.canWriteInvoicePDF === true
) {
  console.log(
    "✔ PASS: Chạy mượt mà trên máy cá nhân qua AWS Profile/Mock, không xung đột với code Production.\n",
  );
  pass++;
} else {
  console.error("✖ FAIL: Bẫy máy phát triển cá nhân chưa được xử lý!\n");
}

// 3. Bẫy dữ liệu 2: Máy chủ ngoài Cloud (On-Premise / Hybrid Cloud)
console.log(
  "[Kiểm tra 3] Bẫy 2 - Tác vụ định kỳ chạy trên máy chủ ngoài Cloud:",
);
const onPremCreds = getCredentials("on-premise");
if (
  onPremCreds.type === "IAM_ROLES_ANYWHERE" &&
  onPremCreds.temporary === true
) {
  console.log(
    "✔ PASS: Áp dụng IAM Roles Anywhere đổi chứng chỉ X.509 lấy Token tạm thời (Zero Static Keys).\n",
  );
  pass++;
} else {
  console.error(
    "✖ FAIL: Bẫy máy chủ ngoài cloud chưa được giải quyết an toàn!\n",
  );
}

// 4. Kiểm tra tính liên tục dịch vụ khi xoay vòng thông tin xác thực
console.log("[Kiểm tra 4] Không làm gián đoạn dịch vụ khi xoay vòng:");
const isZeroDowntimeRotation = prodCreds.temporary && onPremCreds.temporary;
if (isZeroDowntimeRotation) {
  console.log(
    "✔ PASS: Token tạm thời được AWS SDK tự làm mới nền (Background Refresh), không làm ngắt kết nối dịch vụ.\n",
  );
  pass++;
} else {
  console.error(
    "✖ FAIL: Việc xoay vòng thông tin xác thực có thể gây gián đoạn dịch vụ!\n",
  );
}

console.log(
  "-------------------------------------------------------------------",
);
console.log(`KẾT QUẢ ĐÁNH GIÁ: Đạt ${pass}/${total} tiêu chuẩn kiểm định.`);
process.exit(pass === total ? 0 : 1);
