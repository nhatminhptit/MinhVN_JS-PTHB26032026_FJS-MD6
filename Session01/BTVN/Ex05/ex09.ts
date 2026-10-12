import { z } from "zod";

// =========================================================
// MODULE 1: TOOLS DEFINITION (Định nghĩa Lược đồ cho AI)
// =========================================================
const tools = [
  {
    name: "get_night_report",
    description:
      "Lấy báo cáo tổng hợp tình hình vận hành đêm qua (từ 00:00 đến 06:00).",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "request_lock_accounts",
    description: "Tạo yêu cầu khóa các tài khoản spam. TRẢ VỀ MÃ CHỜ XÁC NHẬN.",
    input_schema: {
      type: "object",
      properties: { accountIds: { type: "array", items: { type: "string" } } },
      required: ["accountIds"],
    },
  },
  {
    name: "confirm_action",
    description: "Duyệt và thực thi lệnh ghi dữ liệu dựa trên mã xác nhận.",
    input_schema: {
      type: "object",
      properties: { pendingId: { type: "string" } },
      required: ["pendingId"],
    },
  },
];
// (Lưu ý: Tool thứ 4 get_spam_accounts được khai báo tương tự)

// =========================================================
// MODULE 2: BUSINESS LOGIC (Nghiệp vụ & Xác nhận con người)
// =========================================================
// Biến toàn cục lưu trữ các thao tác chờ duyệt
const pendingActions: Record<string, any> = {};

async function executeTool(toolName: string, input: any) {
  if (toolName === "get_night_report") {
    return JSON.stringify({
      totalOrders: 150,
      failedOrders: 5,
      spamTickets: 42,
    });
  }

  if (toolName === "request_lock_accounts") {
    // Không khóa ngay, đưa vào hàng chờ
    const pendingId = "ACTION_" + Math.floor(Math.random() * 1000);
    pendingActions[pendingId] = {
      action: "LOCK_USERS",
      data: input.accountIds,
    };
    return JSON.stringify({
      status: "PENDING_CONFIRMATION",
      message: `Đã tạo lệnh chờ. Vui lòng báo sếp xác nhận mã ${pendingId} để thực thi.`,
    });
  }

  if (toolName === "confirm_action") {
    const action = pendingActions[input.pendingId];
    if (!action)
      return JSON.stringify({
        error: "Mã xác nhận không hợp lệ hoặc đã hết hạn.",
      });

    // THỰC THI GHI DATABASE TẠI ĐÂY
    delete pendingActions[input.pendingId]; // Xóa khỏi hàng chờ
    return JSON.stringify({
      status: "SUCCESS",
      message: `Đã khóa vĩnh viễn các tài khoản: ${action.data.join(", ")}`,
    });
  }
}

// =========================================================
// MODULE 3: AGENT ORCHESTRATOR (Bộ điều phối & Vòng lặp)
// =========================================================
async function runOperationsAgent(userInput: string) {
  const messages: any[] = [{ role: "user", content: userInput }];
  let loopCount = 0;
  const MAX_LOOPS = 8; // Ràng buộc: không quá 8 vòng lặp

  while (loopCount < MAX_LOOPS) {
    loopCount++;
    // Giả lập gọi API Claude/ChatGPT
    const response = await mockAIClient(messages); 
    
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      return (response.content[0] as any).text;
    }

    if (response.stop_reason === "tool_use") {
      const toolUse = response.content[0] as any;
      const result = await executeTool(toolUse.name, toolUse.input);
      
      messages.push({ 
        role: "user", 
        content: [{ type: "tool_result", tool_use_id: toolUse.id, content: result }] 
      });
    }
  }
  return "Hệ thống tự động ngắt kết nối vì vượt quá số vòng lặp tối đa (8 vòng).";
}

// =========================================================
// MOCK AI (Giả lập bộ não của Agent)
// =========================================================
async function mockAIClient(messages: any[]) {
  const lastMessage = messages[messages.length - 1];

  // NHÁNH 1: Xử lý khi User nhắn tin
  if (lastMessage.role === "user" && typeof lastMessage.content === "string") {
    const text = lastMessage.content.toLowerCase();

    // Kịch bản 1: Nhập rỗng hoặc vô nghĩa
    if (text === "ádfjasdhjk" || text.trim() === "") {
      return {
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text: "Dạ em là trợ lý vận hành ShopFast đây. Em không hiểu ý sếp, sếp cần em báo cáo số liệu đêm qua hay kiểm tra tài khoản nào không ạ?",
          },
        ],
      };
    }

    // Kịch bản 2: Hỏi báo cáo
    if (text.includes("bất thường")) {
      return {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t_report",
            name: "get_night_report",
            input: {},
          },
        ],
      };
    }

    // Kịch bản 3.1: Ra lệnh khóa
    if (text.includes("khóa ngay")) {
      return {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t_lock",
            name: "request_lock_accounts",
            input: { accountIds: ["SPAM_1", "SPAM_2"] },
          },
        ],
      };
    }

    // Kịch bản 3.2: Sếp xác nhận mã lệnh
    if (text.includes("xác nhận chạy")) {
      const match = text.match(/ACTION_\d+/);
      const pendingId = match ? match[0] : "";
      return {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t_confirm",
            name: "confirm_action",
            input: { pendingId: pendingId },
          },
        ],
      };
    }
  }

  // NHÁNH 2: Xử lý khi Backend trả kết quả Tool về cho AI
  if (
    lastMessage.role === "user" &&
    Array.isArray(lastMessage.content) &&
    lastMessage.content[0].type === "tool_result"
  ) {
    const toolMsg = lastMessage.content[0];
    const resultData = JSON.parse(toolMsg.content);

    if (toolMsg.tool_use_id === "t_report") {
      return {
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text: `Báo cáo sếp: Đêm qua có ${resultData.totalOrders} đơn thành công, rớt ${resultData.failedOrders} đơn và xuất hiện bất thường với ${resultData.spamTickets} ticket spam gửi lên hệ thống.`,
          },
        ],
      };
    }
    if (
      toolMsg.tool_use_id === "t_lock" ||
      toolMsg.tool_use_id === "t_confirm"
    ) {
      return {
        stop_reason: "end_turn",
        content: [
          { type: "text", text: resultData.message || resultData.error },
        ],
      };
    }
  }

  return {
    stop_reason: "end_turn",
    content: [{ type: "text", text: "Em chưa hiểu ý sếp ạ." }],
  };
}

// =========================================================
// MODULE 4: TEST RUNNER (Thực thi các kịch bản demo)
// =========================================================
async function main() {
  console.log("--- KỊCH BẢN 1: Bẫy câu hỏi rỗng/vô nghĩa ---");
  console.log("Sếp: ádfjasdhjk");
  console.log("Agent:", await runOperationsAgent("ádfjasdhjk"));

  console.log("\n--- KỊCH BẢN 2: Báo cáo tổng hợp ---");
  console.log("Sếp: Đêm qua có gì bất thường không?");
  console.log(
    "Agent:",
    await runOperationsAgent("Đêm qua có gì bất thường không?"),
  );

  console.log(
    "\n--- KỊCH BẢN 3: Ghi dữ liệu chờ duyệt (Human-in-the-Loop) ---",
  );
  console.log("Sếp: Khóa ngay bọn spam đó lại cho tôi.");
  const lockResponse = await runOperationsAgent(
    "Khóa ngay bọn spam đó lại cho tôi.",
  );
  console.log("Agent:", lockResponse);

  // Bot sinh ra mã ACTION_xxx ngẫu nhiên, ta trích xuất nó để giả lập sếp duyệt lệnh
  const match =
    typeof lockResponse === "string" ? lockResponse.match(/ACTION_\d+/) : null;
  if (match) {
    const confirmCmd = `Tôi xác nhận chạy ${match[0]}`;
    console.log(`\nSếp: ${confirmCmd}`);
    console.log("Agent:", await runOperationsAgent(confirmCmd));
  }
}

// Kích hoạt chạy chương trình
main();
