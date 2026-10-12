import { z } from "zod";

// ==========================================
// 1. MOCK DATABASE & AUTH
// ==========================================
const currentLoggedInUser = "USER_123";

const mockDatabase: Record<string, any> = {
  ORD_001: {
    ownerId: "USER_123",
    status: "CHO_XAC_NHAN",
    province: "Hà Nội",
    address: "Quận 1",
    changedCount: 0,
  },
  ORD_002: {
    ownerId: "USER_123",
    status: "DANG_GIAO",
    province: "Hà Nội",
    address: "Quận 2",
    changedCount: 0,
  },
  ORD_003: {
    ownerId: "USER_123",
    status: "DANG_CHUAN_BI",
    province: "Hà Nội",
    address: "Quận 3",
    changedCount: 1,
  },
  ORD_HACK: {
    ownerId: "USER_999",
    status: "CHO_XAC_NHAN",
    province: "Hà Nội",
    address: "Quận 4",
    changedCount: 0,
  },
};

// ==========================================
// 2. ĐỊNH NGHĨA TOOLS & LƯỢC ĐỒ
// ==========================================
const tools = [
  {
    name: "get_order_info",
    description: "Tra cứu thông tin đơn hàng trước khi quyết định đổi địa chỉ.",
    input_schema: {
      type: "object",
      properties: { orderId: { type: "string" } },
      required: ["orderId"],
      additionalProperties: false,
    },
  },
  {
    name: "update_delivery_address",
    description:
      "Cập nhật địa chỉ mới. Cần tách rõ đường/quận và tỉnh/thành phố.",
    input_schema: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        newAddress: {
          type: "string",
          description: "Số nhà, tên đường, quận/huyện",
        },
        newProvince: { type: "string", description: "Tên tỉnh/thành phố" },
      },
      required: ["orderId", "newAddress", "newProvince"],
      additionalProperties: false,
    },
  },
];

// LỚP CỨNG GUARDRAIL: Bẫy dữ liệu rỗng hoặc chỉ có khoảng trắng
const AddressSchema = z.object({
  orderId: z.string(),
  newAddress: z
    .string()
    .trim()
    .min(5, "Địa chỉ chi tiết không được để trống hoặc quá ngắn"),
  newProvince: z
    .string()
    .trim()
    .min(2, "Thiếu thông tin tỉnh/thành phố hợp lệ"),
});

// ==========================================
// 3. LOGIC XỬ LÝ BACKEND (HÀM TOOL)
// ==========================================
async function executeTool(toolName: string, input: any) {
  const order = mockDatabase[input.orderId];
  if (!order) return JSON.stringify({ error: "Không tìm thấy đơn hàng" });

  if (toolName === "get_order_info") {
    return JSON.stringify(order);
  }

  if (toolName === "update_delivery_address") {
    try {
      // 1. Kiểm tra validation (chặn chuỗi rỗng/khoảng trắng)
      const validData = AddressSchema.parse(input);

      // 2. Kiểm tra quyền sở hữu
      if (order.ownerId !== currentLoggedInUser) {
        return JSON.stringify({
          error: "Bạn không có quyền đổi địa chỉ của đơn hàng này.",
        });
      }

      // 3. Kiểm tra trạng thái hợp lệ
      if (!["CHO_XAC_NHAN", "DANG_CHUAN_BI"].includes(order.status)) {
        return JSON.stringify({
          error: `Đơn hàng đang ở trạng thái ${order.status}, vui lòng liên hệ tổng đài.`,
        });
      }

      // 4. Kiểm tra giới hạn số lần đổi
      if (order.changedCount >= 1) {
        return JSON.stringify({
          error: "Mỗi đơn chỉ được đổi địa chỉ tối đa 1 lần.",
        });
      }

      // 5. Kiểm tra khác tỉnh/thành
      if (
        order.province.toLowerCase() !== validData.newProvince.toLowerCase()
      ) {
        return JSON.stringify({
          error: "Địa chỉ mới khác tỉnh/thành. Vui lòng huỷ đơn và đặt lại.",
        });
      }

      // Ghi dữ liệu thành công
      order.address = validData.newAddress;
      order.changedCount += 1;
      return JSON.stringify({
        status: "SUCCESS",
        message: "Đã cập nhật địa chỉ thành công.",
      });
    } catch (e: any) {
      return JSON.stringify({
        error:
          "Dữ liệu không hợp lệ: " +
          e.issues.map((i: any) => i.message).join(", "),
      });
    }
  }
}

// ==========================================
// 4. MOCK AI MODEL (GIẢ LẬP LUỒNG SUY NGHĨ CỦA AGENT)
// ==========================================
const client = {
  messages: {
    create: async (params: any) => {
      const msgs = params.messages;
      const lastMsg = msgs[msgs.length - 1];

      // Lượt 1: AI yêu cầu đọc data đơn hàng
      if (lastMsg.role === "user" && typeof lastMsg.content === "string") {
        const text = lastMsg.content;
        let orderId = "";
        if (text.includes("ORD_001")) orderId = "ORD_001";
        if (text.includes("ORD_002")) orderId = "ORD_002";
        if (text.includes("ORD_003")) orderId = "ORD_003";
        if (text.includes("ORD_HACK")) orderId = "ORD_HACK";

        return {
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "t1",
              name: "get_order_info",
              input: { orderId },
            },
          ],
        };
      }

      // Lượt 2: AI nhận kết quả từ get_order_info, quyết định gọi update_address
      if (
        lastMsg.role === "user" &&
        Array.isArray(lastMsg.content) &&
        lastMsg.content[0].tool_use_id === "t1"
      ) {
        const orderData = JSON.parse(lastMsg.content[0].content);
        const originalInput = msgs[0].content; // Lấy câu hỏi gốc để trích xuất địa chỉ

        let newAddress = "";
        let newProvince = "";

        if (originalInput.includes("Cầu Giấy, Hà Nội")) {
          newAddress = "Cầu Giấy";
          newProvince = "Hà Nội";
        }
        if (originalInput.includes("Quận 1, TP HCM")) {
          newAddress = "Quận 1";
          newProvince = "TP HCM";
        }
        if (originalInput.includes("   , Hà Nội")) {
          newAddress = "   ";
          newProvince = "Hà Nội";
        } // Cố tình nhập rỗng

        // Agent tự chối nếu thấy sai logic từ tool 1
        if (orderData.status === "DANG_GIAO") {
          return {
            stop_reason: "end_turn",
            content: [
              {
                type: "text",
                text: "Đơn hàng đang giao, bạn vui lòng gọi tổng đài nhé.",
              },
            ],
          };
        }
        if (orderData.changedCount >= 1) {
          return {
            stop_reason: "end_turn",
            content: [
              {
                type: "text",
                text: "Đơn này đã được đổi địa chỉ 1 lần rồi, không đổi được nữa.",
              },
            ],
          };
        }

        return {
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              id: "t2",
              name: "update_delivery_address",
              input: {
                orderId: orderData.ownerId
                  ? msgs[0].content.match(/ORD_\w+/)[0]
                  : "",
                newAddress,
                newProvince,
              },
            },
          ],
        };
      }

      // Lượt 3: AI nhận kết quả update và báo cho khách
      if (
        lastMsg.role === "user" &&
        Array.isArray(lastMsg.content) &&
        lastMsg.content[0].tool_use_id === "t2"
      ) {
        const result = JSON.parse(lastMsg.content[0].content);
        return {
          stop_reason: "end_turn",
          content: [
            {
              type: "text",
              text: result.error ? `Lỗi: ${result.error}` : result.message,
            },
          ],
        };
      }
    },
  },
};

// ==========================================
// 5. TEST RUNNER
// ==========================================
async function runAgent(userInput: string) {
  const messages: any[] = [{ role: "user", content: userInput }];
  console.log(`\nKhách hàng: "${userInput}"`);

  while (true) {
    const response = await client.messages.create({ messages });

    if (!response || !response.content) {
      console.log("Lỗi: Không nhận được phản hồi hợp lệ từ model.");
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      console.log("Agent:", (response.content[0] as any).text);
      break;
    }

    if (response.stop_reason === "tool_use") {
      const toolUse = response.content[0] as any;
      const result = await executeTool(toolUse.name, toolUse.input);
      messages.push({
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: toolUse.id, content: result },
        ],
      });
    }
  }
}

async function main() {
  await runAgent("Đổi đơn ORD_001 sang Cầu Giấy, Hà Nội giúp tôi"); // Hợp lệ
  await runAgent("Đổi đơn ORD_002 sang Cầu Giấy, Hà Nội"); // Lỗi: Đang giao
  await runAgent("Đổi đơn ORD_001 sang Quận 1, TP HCM"); // Lỗi: Khác tỉnh (hệ thống sẽ check vì ORD_001 gốc ở Hà Nội)
  await runAgent("Đổi đơn ORD_003 sang Cầu Giấy, Hà Nội"); // Lỗi: Đã đổi 1 lần
  await runAgent("Đổi đơn ORD_HACK sang Cầu Giấy, Hà Nội"); // Lỗi: Sai ownerId
  await runAgent("Đổi đơn ORD_001 sang    , Hà Nội"); // Lỗi: Địa chỉ rỗng
}

main();
