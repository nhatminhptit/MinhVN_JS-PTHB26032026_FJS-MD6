const fs = require("fs");
const path = require("path");

const trustPolicy = JSON.parse(
  fs.readFileSync(path.join(__dirname, "trust-policy.json"), "utf8"),
);
const ecrPolicy = JSON.parse(
  fs.readFileSync(path.join(__dirname, "ecr-push-policy.json"), "utf8"),
);
const pipeline = fs.readFileSync(path.join(__dirname, "pipeline.yml"), "utf8");

console.log("===============================================================");
console.log("KIỂM THỬ ĐÁNH GIÁ CẤU HÌNH ROLE VÀ PIPELINE OIDC (EX02)");
console.log(
  "===============================================================\n",
);

let pass = 0;
const total = 5;

// Check 1: Đối tượng nhận token (aud)
const aud =
  trustPolicy.Statement[0]?.Condition?.StringEquals?.[
    "token.actions.githubusercontent.com:aud"
  ];
if (aud === "sts.amazonaws.com") {
  console.log("[✔ PASS 1] Đối tượng nhận token (aud): sts.amazonaws.com");
  pass++;
} else {
  console.error("[✖ FAIL 1] Thiếu hoặc sai cấu hình aud!");
}

// Check 2: Neo chặt định danh repo và nhánh main (sub)
const sub =
  trustPolicy.Statement[0]?.Condition?.StringEquals?.[
    "token.actions.githubusercontent.com:sub"
  ];
if (sub === "repo:shopfast/backend:ref:refs/heads/main") {
  console.log("[✔ PASS 2] Neo chặt chính xác tổ chức, kho mã và nhánh: " + sub);
  pass++;
} else {
  console.error("[✖ FAIL 2] Chưa neo chặt hoặc dùng sai định danh sub!");
}

// Check 3: Bẫy dữ liệu - Kiểm tra chống lách repo giả mạo
const hasWildcardPrefix = sub ? sub.startsWith("*") : true;
if (!hasWildcardPrefix && sub.startsWith("repo:shopfast/backend")) {
  console.log(
    "[✔ PASS 3] Chống bẫy dữ liệu: Không có ký tự đại diện ở đầu chuỗi (Chặn hacker/shopfast/backend)",
  );
  pass++;
} else {
  console.error("[✖ FAIL 3] Bẫy dữ liệu chưa được xử lý triệt để!");
}

// Check 4: Chính sách quyền ECR tối thiểu (Không cấp ecr:*)
const ecrActions = ecrPolicy.Statement.flatMap((s) =>
  Array.isArray(s.Action) ? s.Action : [s.Action],
);
const hasWildcardECR = ecrActions.includes("ecr:*");
const hasPutImage = ecrActions.includes("ecr:PutImage");
if (!hasWildcardECR && hasPutImage) {
  console.log(
    "[✔ PASS 4] Quyền ECR tối thiểu: Cho phép đẩy image, tuyệt đối không cấp ecr:*",
  );
  pass++;
} else {
  console.error(
    "[✖ FAIL 4] Quyền ECR chưa tối ưu (vẫn chứa ecr:* hoặc thiếu quyền push)!",
  );
}

// Check 5: Pipeline sử dụng OIDC và không còn Access Key dài hạn
const hasIdToken = pipeline.includes("id-token: write");
const hasRoleAssume = pipeline.includes("role-to-assume");
const hasLongTermKey =
  pipeline.includes("AWS_ACCESS_KEY_ID") ||
  pipeline.includes("AWS_SECRET_ACCESS_KEY");
if (hasIdToken && hasRoleAssume && !hasLongTermKey) {
  console.log(
    "[✔ PASS 5] Pipeline CI/CD chuẩn OIDC: Không còn khóa dài hạn, có quyền id-token: write",
  );
  pass++;
} else {
  console.error(
    "[✖ FAIL 5] Pipeline còn chứa khóa dài hạn hoặc thiếu cấu hình OIDC!",
  );
}

console.log(
  "\n---------------------------------------------------------------",
);
console.log(`KẾT QUẢ ĐÁNH GIÁ: ${pass}/${total} tiêu chuẩn đạt yêu cầu.`);
process.exit(pass === total ? 0 : 1);
