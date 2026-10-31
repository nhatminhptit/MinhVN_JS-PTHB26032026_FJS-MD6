const fs = require("fs");
const path = require("path");

const internPolicy = JSON.parse(
  fs.readFileSync(path.join(__dirname, "policies/intern-policy.json"), "utf8"),
);
const devopsPolicy = JSON.parse(
  fs.readFileSync(path.join(__dirname, "policies/devops-policy.json"), "utf8"),
);
const appRole = JSON.parse(
  fs.readFileSync(path.join(__dirname, "roles/app-instance-role.json"), "utf8"),
);
const cicdRole = JSON.parse(
  fs.readFileSync(path.join(__dirname, "roles/cicd-oidc-role.json"), "utf8"),
);

function evaluate(policy, { action, resource, mfa = false }) {
  let isExplicitDeny = false;
  let isExplicitAllow = false;

  for (const stmt of policy.Statement) {
    const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
    const resources = Array.isArray(stmt.Resource)
      ? stmt.Resource
      : [stmt.Resource];

    const matchAct = actions.some(
      (a) =>
        a === "*" ||
        a === action ||
        (a.endsWith("*") && action.startsWith(a.slice(0, -1))),
    );
    const matchRes = resources.some(
      (r) =>
        r === "*" ||
        r === resource ||
        (r.endsWith("*") && resource.startsWith(r.slice(0, -1))),
    );

    if (matchAct && matchRes) {
      let applies = true;
      if (
        stmt.Condition &&
        stmt.Condition.BoolIfExists &&
        stmt.Condition.BoolIfExists["aws:MultiFactorAuthPresent"] === "false"
      ) {
        applies = !mfa;
      }
      if (applies) {
        if (stmt.Effect === "Deny") isExplicitDeny = true;
        if (stmt.Effect === "Allow") isExplicitAllow = true;
      }
    }
  }

  if (isExplicitDeny) return "DENY";
  if (isExplicitAllow) return "ALLOW";
  return "DENY"; // Mặc định từ chối ngầm
}

console.log(
  "===================================================================",
);
console.log("KIỂM ĐỊNH NỀN TẢNG QUẢN TRỊ TRUY CẬP CLOUD SHOPFAST (EX05)");
console.log(
  "===================================================================\n",
);

let pass = 0;
const total = 4;

// KỊCH BẢN 1: Thao tác được phép
console.log(
  "[Kịch bản 1] Thao tác được phép: Intern đọc tài nguyên môi trường Dev",
);
const res1 = evaluate(internPolicy, {
  action: "s3:GetObject",
  resource: "arn:aws:s3:::shopfast-dev-assets/logo.png",
});
if (res1 === "ALLOW") {
  console.log("  => Kết quả: ALLOW (Hợp lệ đúng ranh giới vai trò)\n");
  pass++;
} else {
  console.error("  => Thất bại kịch bản 1!\n");
}

// KỊCH BẢN 2: Bị chặn bởi nguyên tắc đặc quyền tối thiểu
console.log(
  "[Kịch bản 2] Bị chặn bởi đặc quyền tối thiểu: Intern thử xóa bucket sao lưu sản xuất",
);
const res2 = evaluate(internPolicy, {
  action: "s3:DeleteBucket",
  resource: "arn:aws:s3:::shopfast-prod-backup-db",
});
if (res2 === "DENY") {
  console.log(
    "  => Kết quả: DENY (Từ chối ngầm - Thực tập sinh không thể xóa tài nguyên quan trọng)\n",
  );
  pass++;
} else {
  console.error("  => Thất bại kịch bản 2!\n");
}

// KỊCH BẢN 3: Bị chặn bởi lớp kiểm soát bổ sung (2 lớp kiểm soát: Thiếu MFA)
console.log(
  "[Kịch bản 3] Bị chặn bởi lớp kiểm soát bổ sung: DevOps xóa bucket Prod khi KHÔNG CÓ MFA",
);
const res3 = evaluate(devopsPolicy, {
  action: "s3:DeleteBucket",
  resource: "arn:aws:s3:::shopfast-prod-data",
  mfa: false,
});
if (res3 === "DENY") {
  console.log(
    "  => Kết quả: DENY (Bị chặn bởi Explicit Deny khi phiên thiếu xác thực MFA)\n",
  );
  pass++;
} else {
  console.error("  => Thất bại kịch bản 3!\n");
}

// TIÊU CHUẨN 4: Kiểm tra không tồn tại khóa truy cập dài hạn (Zero Long-term Keys)
console.log(
  "[Tiêu chuẩn 4] Chứng minh không dùng khóa dài hạn cho ứng dụng và CI/CD",
);
const isEC2RoleValid =
  appRole.Statement[0]?.Principal?.Service === "ec2.amazonaws.com";
const isOIDCRoleValid = cicdRole.Statement[0]?.Principal?.Federated?.includes(
  "oidc-provider/token.actions.githubusercontent.com",
);
if (isEC2RoleValid && isOIDCRoleValid) {
  console.log(
    "  => Xác nhận: Ứng dụng dùng Instance Profile, CI/CD dùng GitHub OIDC (Không có Access Key tĩnh)\n",
  );
  pass++;
} else {
  console.error("  => Cấu hình Role chưa đạt chuẩn không dùng khóa!\n");
}

console.log(
  "-------------------------------------------------------------------",
);
console.log(
  `KẾT QUẢ ĐÁNH GIÁ: ${pass}/${total} tiêu chuẩn kiểm định hoàn hảo.`,
);
process.exit(pass === total ? 0 : 1);
