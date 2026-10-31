// Session06/Ex05/test.js
const fs = require("fs");

console.log("=== [STAGE 2: QUALITY GATE] KIỂM TRA CHẤT LƯỢNG MÃ NGUỒN ===");

// 1. Giả lập kiểm tra Unit/Integration Test
const allTestsPassed = process.env.TRIGGER_TEST_FAIL !== "true";

// 2. Giả lập tính toán Code Coverage (Độ phủ mã nguồn)
const codeCoverage = process.env.LOW_COVERAGE === "true" ? 65 : 88;

console.log(
  `- Trạng thái kiểm thử: ${allTestsPassed ? "PASSED (100%)" : "FAILED"}`,
);
console.log(
  `- Độ phủ mã nguồn đạt được: ${codeCoverage}% (Ngưỡng yêu cầu: >= 80%)`,
);

if (!allTestsPassed) {
  console.error("=> LỖI: Một số bài kiểm thử đơn vị bị thất bại!");
  process.exit(1);
}

if (codeCoverage < 80) {
  console.error(
    `=> LỖI CỔNG KIỂM SOÁT: Độ phủ ${codeCoverage}% thấp hơn ngưỡng tiêu chuẩn 80%! Chặn xuất xưởng.`,
  );
  process.exit(1);
}

console.log(
  "=> CHÚC MỪNG: Cổng kiểm soát chất lượng đã được thông qua an toàn!",
);
process.exit(0);
