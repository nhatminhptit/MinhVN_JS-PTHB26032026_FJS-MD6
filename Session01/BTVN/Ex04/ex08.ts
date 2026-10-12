import { z } from "zod";

// ==========================================
// 1. SCHEMAS & GIẢ LẬP
// ==========================================
// Cấu trúc ép model trả về mảng, giải quyết bẫy "2 vấn đề cùng lúc"
const RoutingSchema = z.object({
  teams: z.array(
    z.enum(["CSKH_CHUNG", "KHO_HANG", "THANH_TOAN", "CAN_TRA_CUU"]),
  ),
  reason: z.string(),
});

const mockDB: Record<string, any> = { ORD_123: { status: "MAT_HANG" } };

async function executeOrderLookup(orderId: string) {
  return JSON.stringify(mockDB[orderId] || { error: "Not found" });
}

// ==========================================
// 2. HÀM TIỀN XỬ LÝ (TRÁNH BẪY 4.000 TỪ)
// ==========================================
function truncateTicket(ticketText: string): string {
  const MAX_LEN = 2000;
  if (ticketText.length <= MAX_LEN) return ticketText;
  // Cắt lấy phần đầu và phần cuối của đoạn chat dài
  return (
    ticketText.substring(0, 1000) +
    "\n...[NỘI DUNG ĐÃ LƯỢC BỚT]...\n" +
    ticketText.substring(ticketText.length - 1000)
  );
}

// ==========================================
// 3. LOGIC ĐỊNH TUYẾN KIẾN TRÚC LAI
// ==========================================
async function routeTicket(ticketText: string) {
  const cleanTicket = truncateTicket(ticketText);

  // BƯỚC 1: CỔNG PHÂN LOẠI NHANH (SINGLE CALL)
  // Trong thực tế, bạn gọi API model ở chế độ JSON Output (dùng schema RoutingSchema)
  console.log("-> [Luồng 1] Đang phân tích nhanh ticket...");

  // MOCK: Phân tích dựa trên từ khóa để minh họa
  let initialTeams: string[] = [];
  if (cleanTicket.includes("áo mã SKU") && cleanTicket.includes("trừ tiền")) {
    initialTeams = ["KHO_HANG", "THANH_TOAN"]; // Đa vấn đề
  } else if (cleanTicket.includes("đơn 1024 của tôi đâu")) {
    initialTeams = ["CAN_TRA_CUU"]; // Cần số liệu
  } else {
    initialTeams = ["CSKH_CHUNG"];
  }

  // BƯỚC 2: XỬ LÝ RẼ NHÁNH
  if (!initialTeams.includes("CAN_TRA_CUU")) {
    // Thuộc nhóm 70% -> Chốt ngay, độ trễ < 1s, chi phí cực rẻ
    return initialTeams;
  }

  // BƯỚC 3: LUỒNG AGENT TRA CỨU (Dành cho 30% còn lại)
  console.log("-> [Luồng 2] Phát hiện cần tra cứu. Kích hoạt Agent...");

  // MOCK AGENT FLOW
  const orderIdExtracted = "ORD_123";
  const dbData = await executeOrderLookup(orderIdExtracted);

  // Agent đọc dbData và ra quyết định cuối cùng
  const finalTeams = dbData.includes("MAT_HANG")
    ? ["XU_LY_SU_CO"]
    : ["CSKH_CHUNG"];
  return finalTeams;
}

// ==========================================
// 4. TEST CASES
// ==========================================
async function run() {
  console.log("=== BẪY 1: Ticket 4000 từ ===");
  const longTicket =
    "Chào shop ".repeat(500) +
    "Tôi muốn hỏi chính sách đổi trả" +
    " cảm ơn ".repeat(500);
  console.log("Kết quả:", await routeTicket(longTicket));

  console.log("\n=== BẪY 2: Đa vấn đề ===");
  const multiTicket =
    "Áo mã SKU này còn size L không? Với lại nãy tôi thanh toán bị trừ tiền 2 lần.";
  console.log("Kết quả:", await routeTicket(multiTicket));
}

run();
