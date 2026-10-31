/**
 * Mô phỏng giải pháp: Default Credential Provider Chain kết hợp AWS Secrets Manager
 * Tự động tìm nguồn xác thực theo thứ tự:
 * 1. Biến môi trường (Dành cho Dev cục bộ)
 * 2. IAM Roles Anywhere (Dành cho máy chủ ngoài Cloud)
 * 3. IAM Instance Profile / EC2 Metadata (Dành cho máy chủ Cloud Production)
 */

function getCredentials(
  environmentContext = process.env.NODE_ENV || "production",
) {
  if (environmentContext === "local") {
    return {
      type: "LOCAL_DEV_PROFILE",
      source: "~/.aws/credentials (Developer Sandbox)",
      temporary: false,
      riskLevel: "LOW (Chỉ có quyền trên S3 Dev)",
      canWriteInvoicePDF: true,
      canReadDBCredentials: true,
    };
  }

  if (environmentContext === "on-premise") {
    return {
      type: "IAM_ROLES_ANYWHERE",
      source: "X.509 Certificate -> AWS STS Temporary Token (1h)",
      temporary: true,
      riskLevel: "LOW (Token tự hủy sau 1 giờ)",
      canWriteInvoicePDF: true,
      canReadDBCredentials: false, // Phân quyền tối thiểu: batch job ngoài cloud chỉ ghi file
    };
  }

  // Mặc định là máy chủ Cloud EC2
  return {
    type: "EC2_INSTANCE_PROFILE_ROLE",
    source: "AWS Instance Metadata Service (IMDSv2)",
    temporary: true,
    riskLevel:
      "VERY_LOW (Không lưu khóa trên đĩa, tự động xoay vòng mỗi 6 giờ)",
    canWriteInvoicePDF: true,
    canReadDBCredentials: true,
  };
}

async function runApplicationTask(env) {
  const creds = getCredentials(env);
  console.log(`[Khởi động ứng dụng] Môi trường: ${env.toUpperCase()}`);
  console.log(`- Cơ chế xác thực: ${creds.type}`);
  console.log(`- Nguồn thông tin: ${creds.source}`);
  console.log(
    `- Tính chất thông tin xác thực: ${creds.temporary ? "TẠM THỜI (Tự động xoay vòng)" : "DÀI HẠN (Cục bộ)"}`,
  );

  // Tác vụ 1: Ghi hóa đơn PDF vào S3
  if (creds.canWriteInvoicePDF) {
    console.log(
      "✔ [S3] Ghi hóa đơn PDF vào s3://shopfast-invoices/2026/inv-001.pdf: THÀNH CÔNG",
    );
  }

  // Tác vụ 2: Lấy bí mật kết nối Database từ Secrets Manager
  if (creds.canReadDBCredentials) {
    console.log(
      "✔ [Secrets Manager] Lấy mật khẩu DB qua role: THÀNH CÔNG (postgresql://app_user:***@rds:5432/shopfast)",
    );
  } else {
    console.log(
      "⚠ [Secrets Manager] Bị từ chối do không có quyền đọc mật khẩu CSDL (Đúng nguyên tắc đặc quyền tối thiểu)",
    );
  }

  return creds;
}

module.exports = { getCredentials, runApplicationTask };
