// ==========================================
// PHẦN 1: GIẢ LẬP MÔI TRƯỜNG (MOCK DATA)
// ==========================================

const tools = [
  {
    name: "get_order_status",
    description: "Tra cứu đơn hàng",
    input_schema: {
      type: "object",
      properties: { orderId: { type: "string" } },
    },
  },
];

async function executeTool(toolName: string, toolInput: any) {
  if (toolName === "get_order_status" && toolInput.orderId === "1024") {
    return JSON.stringify({ status: "DANG_GIAO", eta: "2026-09-06" });
  }
  return JSON.stringify({ error: "Order not found" });
}

const client = {
  messages: {
    create: async (params: any) => {
      const lastMessage = params.messages[params.messages.length - 1];

      if (lastMessage.content === "Xin chào") {
        return {
          stop_reason: "end_turn",
          content: [
            {
              type: "text",
              text: "Chào bạn, trợ lý ShopFast có thể giúp gì cho bạn?",
            },
          ],
        };
      }

      if (
        typeof lastMessage.content === "string" &&
        lastMessage.content.includes("1024")
      ) {
        return {
          stop_reason: "tool_use",
          content: [
            {
              type: "text",
              text: "Để tôi tra cứu trên hệ thống giúp bạn nhé.",
            },
            {
              type: "tool_use",
              id: "toolu_01A7bK",
              name: "get_order_status",
              input: { orderId: "1024" },
            },
          ],
        };
      }

      if (
        lastMessage.role === "user" &&
        Array.isArray(lastMessage.content) &&
        lastMessage.content[0]?.type === "tool_result"
      ) {
        return {
          stop_reason: "end_turn",
          content: [
            {
              type: "text",
              text: "Đơn hàng 1024 của bạn đang được giao, dự kiến nhận vào ngày 06/09/2026 nhé!",
            },
          ],
        };
      }

      return {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Xin lỗi, tôi chưa hiểu ý bạn." }],
      };
    },
  },
};

// ==========================================
// PHẦN 2: HÀM AGENT ĐÃ ĐƯỢC VÁ LỖI
// ==========================================

async function runAgent(userInput: string) {
  const messages: any[] = [{ role: "user", content: userInput }];

  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b: any) => b.type === "text");
      return textBlock ? textBlock.text : "";
    }

    if (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter(
        (b: any) => b.type === "tool_use",
      );
      const toolResultsContent = [];

      for (const tool of toolUses) {
        const result = await executeTool(String(tool.name), tool.input);
        toolResultsContent.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: result,
        });
      }

      messages.push({
        role: "user",
        content: toolResultsContent,
      });
    }
  }
}

// ==========================================
// PHẦN 3: CHẠY THỬ NGHIỆM THU TEST CASE
// ==========================================

async function main() {
  console.log("========== TEST CASE 1 ==========");
  console.log("User: Xin chào");
  const res1 = await runAgent("Xin chào");
  console.log("Agent:", res1);

  console.log("\n========== TEST CASE 2 ==========");
  console.log("User: Đơn 1024 của tôi đang ở đâu?");
  const res2 = await runAgent("Đơn 1024 của tôi đang ở đâu?");
  console.log("Agent:", res2);
}

main();
