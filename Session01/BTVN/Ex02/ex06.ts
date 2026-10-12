// ==========================================
// BÀI TẬP 6: ĐIỀN KHUYẾT LƯỢC ĐỒ TOOL (SCHEMA VALIDATION)
// ==========================================

import { z } from "zod";

// ---------------------------------------------------------
// 1. HOÀN THIỆN 5 CHỖ KHUYẾT TRONG LƯỢC ĐỒ TOOL
// ---------------------------------------------------------
const createRefundTool = {
  name: "create_refund",
  // (1) Mô tả chi tiết: Dặn dò model rõ ràng về giới hạn số tiền và đơn vị
  description:
    "Tạo phiếu hoàn tiền cho khách hàng. " +
    "CHÚ Ý QUAN TRỌNG: Đơn vị tiền tệ luôn là VNĐ (ví dụ 5tr = 5000000). " +
    "Chỉ được phép hoàn tiền nếu lý do nằm trong danh sách được duyệt. " +
    "Số tiền hoàn tối đa không vượt quá 5.000.000 VNĐ.",

  // Bật chế độ kiểm tra nghiêm ngặt
  strict: true,

  input_schema: {
    type: "object",
    properties: {
      orderId: {
        type: "string",
        description: "Mã đơn hàng cần hoàn tiền",
      },
      amount: {
        type: "number",
        // (2) Ràng buộc giới hạn số: Tối đa 5.000.000đ, tối thiểu 1000đ (để tránh lỗi chia)
        minimum: 1000,
        maximum: 5000000,
        description: "Số tiền cần hoàn (bằng VNĐ, không được vượt quá 5 triệu)",
      },
      reason: {
        type: "string",
        // (3) Ràng buộc giá trị bằng Enum: Ép buộc chỉ được chọn 3 lý do duyệt sẵn
        enum: ["HANG_LOI", "GIAO_CHAM", "TRU_TIEN_2_LAN"],
        description: "Lý do hoàn tiền. Chỉ dùng 1 trong 3 mã hợp lệ quy định.",
      },
    },
    // (4) Khai báo trường bắt buộc
    required: ["orderId", "amount", "reason"],
    // (5) Chặn trường lạ
    additionalProperties: false,
  },
};

// ---------------------------------------------------------
// 2. GIẢ LẬP HÀM VALIDATE Ở BACKEND (LỚP CỨNG GUARDRAIL)
// ---------------------------------------------------------
// Dùng thư viện Zod để kiểm chứng độ an toàn của dữ liệu model gửi xuống
const RefundSchema = z.object({
  orderId: z.string(),
  amount: z
    .number()
    .min(1000)
    .max(5000000, "Số tiền hoàn không được vượt quá 5.000.000đ"),
  reason: z.enum(["HANG_LOI", "GIAO_CHAM", "TRU_TIEN_2_LAN"]),
});

async function executeCreateRefund(inputFromModel: any) {
  try {
    // Kích hoạt Guardrail cứng: Parse dữ liệu
    const validData = RefundSchema.parse(inputFromModel);
    return JSON.stringify({
      status: "SUCCESS",
      message: `Đã tạo phiếu hoàn ${validData.amount.toLocaleString("vi-VN")}đ cho đơn ${validData.orderId}`,
    });
  } catch (error: any) {
    // Nếu dữ liệu (do khách ép hoặc model ngáo) lọt qua, Zod sẽ chặn lại
    return JSON.stringify({
      status: "ERROR",
      message:
        "Từ chối tạo phiếu: " +
        error.issues.map((i: any) => i.message).join(", "),
    });
  }
}

// ---------------------------------------------------------
// 3. GIẢ LẬP MODEL XỬ LÝ (MOCK CLAUDE AI)
// ---------------------------------------------------------
const client = {
  messages: {
    create: async (params: any) => {
      const userInput = params.messages[0].content.toLowerCase();

      // Test Case 1: Yêu cầu hợp lệ, có viết tắt đơn vị "5tr"
      if (userInput.includes("hoàn 5tr") && userInput.includes("hàng lỗi")) {
        return {
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "tool_valid",
              name: "create_refund",
              input: { orderId: "ORD123", amount: 5000000, reason: "HANG_LOI" },
            },
          ],
        };
      }

      // Test Case 2: Yêu cầu sai (50 triệu, lý do bịa) -> Model cố tình tạo sai theo khách
      if (
        userInput.includes("hoàn 50 triệu") &&
        userInput.includes("không thích màu")
      ) {
        return {
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "tool_invalid",
              name: "create_refund",
              input: {
                orderId: "ORD999",
                amount: 50000000,
                reason: "KHONG_THICH_MAU",
              },
            },
          ],
        };
      }

      return {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Xin lỗi, không hiểu yêu cầu." }],
      };
    },
  },
};

// ---------------------------------------------------------
// 4. CHẠY KIỂM THỬ (TEST RUNNER)
// ---------------------------------------------------------
async function runTest(testName: string, userInput: string) {
  console.log(`\n========== ${testName} ==========`);
  console.log(`Khách hàng: "${userInput}"`);

  const response = await client.messages.create({
    messages: [{ role: "user", content: userInput }],
  });

  if (response.stop_reason === "tool_use") {
    const toolUse = response.content[0] as any;
    console.log(
      `[AI Đề Xuất] Gọi tool: ${toolUse.name} với tham số:`,
      toolUse.input,
    );

    const backendResult = await executeCreateRefund(toolUse.input);
    console.log(`[Backend Phản Hồi] ${backendResult}`);
  }
}

async function main() {
  await runTest(
    "TEST CASE 1: YÊU CẦU HỢP LỆ VÀ XỬ LÝ VIẾT TẮT",
    "Đơn ORD123 bị hàng lỗi, cho tôi hoàn 5tr nhé",
  );

  await runTest(
    "TEST CASE 2: CHẶN VI PHẠM (HOÀN 50 TR, LÝ DO BỊA)",
    "Đơn ORD999 khách bảo không thích màu, hoàn 50 triệu ngay đi",
  );
}

main();
