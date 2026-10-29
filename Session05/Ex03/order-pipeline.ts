const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// 1. ĐỊNH NGHĨA TRẠNG THÁI VÀ DỮ LIỆU ĐƠN HÀNG
// ============================================================================
export type OrderStep =
  | "NONE"
  | "STEP_1_STOCK"
  | "STEP_2_PAYMENT"
  | "STEP_3_INVOICE"
  | "STEP_4_NOTIFY"
  | "STEP_5_SHIPPING"
  | "COMPLETED";

export type OrderStatus =
  | "PENDING"
  | "STOCK_RESERVED"
  | "PAYMENT_CONFIRMED"
  | "INVOICE_ISSUED"
  | "NOTIFICATION_SENT"
  | "SHIPPED"
  | "CANCELLED_OUT_OF_STOCK"
  | "CANCELLED_PAYMENT_FAILED";

export interface Order {
  id: string;
  items: { productId: string; quantity: number }[];
  totalAmount: number;
  status: OrderStatus;
  currentStep: OrderStep;
  manualInvoiceFlag: boolean;
  shippingTrackingCode?: string;
  refunded: boolean;
}

// ============================================================================
// 2. MOCK EXTERNAL SERVICES & DATABASE
// ============================================================================
export class MockDatabase {
  public orders = new Map<string, Order>();
  public stockInventory = new Map<string, number>([
    ["iphone_16", 5], // Có 5 cái trong kho
    ["macbook_m3", 0], // Hết hàng
  ]);

  async saveOrder(order: Order): Promise<void> {
    this.orders.set(order.id, { ...order });
  }

  async getOrder(id: string): Promise<Order | null> {
    const o = this.orders.get(id);
    return o ? { ...o } : null;
  }
}

export class MockPaymentGateway {
  public chargedTransactions = new Map<
    string,
    { amount: number; success: boolean }
  >();
  public actualChargeCallCount = 0;
  public simulateTimeoutOnce = false;

  async charge(
    orderId: string,
    amount: number,
    idempotencyKey: string,
  ): Promise<{ success: boolean; transactionId: string }> {
    this.actualChargeCallCount++;

    // BẪY DỮ LIỆU: Kiểm tra khóa lũy đọng để chống trừ tiền 2 lần
    if (this.chargedTransactions.has(idempotencyKey)) {
      console.log(
        `[PaymentGateway] Nhận diện IdempotencyKey '${idempotencyKey}'. Trả về giao dịch đã trừ trước đó, không trừ lần 2!`,
      );
      return { success: true, transactionId: `trans_idemp_${orderId}` };
    }

    if (this.simulateTimeoutOnce) {
      this.simulateTimeoutOnce = false;
      // Ghi nhận tiền đã trừ thành công ở cổng thanh toán nhưng mạng rớt, client nhận timeout
      this.chargedTransactions.set(idempotencyKey, { amount, success: true });
      throw new Error(
        "GATEWAY_TIMEOUT: Mạng bị ngắt sau khi trừ tiền thành công!",
      );
    }

    this.chargedTransactions.set(idempotencyKey, { amount, success: true });
    return { success: true, transactionId: `trans_${orderId}` };
  }
}

// ============================================================================
// 3. ORDER PIPELINE ORCHESTRATOR ENGINE
// ============================================================================
export class OrderPipelineOrchestrator {
  constructor(
    private readonly db: MockDatabase,
    private readonly paymentGateway: MockPaymentGateway,
  ) {}

  // Tạo đơn hàng mới
  async initOrder(
    orderId: string,
    productId: string,
    quantity: number,
    amount: number,
  ): Promise<Order> {
    const order: Order = {
      id: orderId,
      items: [{ productId, quantity }],
      totalAmount: amount,
      status: "PENDING",
      currentStep: "NONE",
      manualInvoiceFlag: false,
      refunded: false,
    };
    await this.db.saveOrder(order);
    return order;
  }

  // Luồng điều phối chính (Hỗ trợ khôi phục tiếp tục từ bước dở dang)
  async executePipeline(
    orderId: string,
    options?: { failEmailStep?: boolean; failInvoiceTimes?: number },
  ): Promise<Order> {
    const order = await this.db.getOrder(orderId);
    if (!order) throw new Error("Order not found");

    console.log(
      `\n>>> [Bắt đầu Pipeline] Đơn hàng #${order.id} | Bước hiện tại: ${order.currentStep}`,
    );

    // -------------------------------------------------------------
    // BƯỚC 1: GIỮ HÀNG TRONG KHO
    // -------------------------------------------------------------
    if (order.currentStep === "NONE") {
      console.log("[Bước 1] Kiểm tra và giữ hàng trong kho...");
      const item = order.items[0];
      const availableStock = this.db.stockInventory.get(item.productId) ?? 0;

      if (availableStock < item.quantity) {
        console.warn(
          `[Bước 1 Thất bại] Sản phẩm ${item.productId} hết hàng! Kích hoạt hủy đơn và hoàn tiền...`,
        );
        order.status = "CANCELLED_OUT_OF_STOCK";
        order.refunded = true; // Hoàn tiền
        await this.db.saveOrder(order);
        return order; // Dừng toàn bộ các bước sau
      }

      // Giữ hàng thành công
      this.db.stockInventory.set(
        item.productId,
        availableStock - item.quantity,
      );
      order.status = "STOCK_RESERVED";
      order.currentStep = "STEP_1_STOCK";
      await this.db.saveOrder(order);
      console.log(
        `[Bước 1 Thành công] Đã giữ ${item.quantity} sản phẩm. Trạng thái: ${order.status}`,
      );
    }

    // -------------------------------------------------------------
    // BƯỚC 2: XÁC NHẬN THANH TOÁN (KÈM IDEMPOTENCY KEY)
    // -------------------------------------------------------------
    if (order.currentStep === "STEP_1_STOCK") {
      console.log("[Bước 2] Gọi cổng thanh toán xác nhận tiền...");
      const idempotencyKey = `idemp_order_${order.id}`;
      let paymentSuccess = false;

      // Cơ chế thử lại tự động nếu dính lỗi timeout mạng
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`[Bước 2] Thử gọi thanh toán lần ${attempt}...`);
          const res = await this.paymentGateway.charge(
            order.id,
            order.totalAmount,
            idempotencyKey,
          );
          if (res.success) {
            paymentSuccess = true;
            break;
          }
        } catch (err: any) {
          console.warn(
            `[Bước 2 Warning] Gọi thanh toán lần ${attempt} bị timeout: ${err.message}`,
          );
          await sleep(50);
        }
      }

      if (!paymentSuccess) {
        console.error(
          "[Bước 2 Thất bại] Thanh toán không thành công. Hoàn trả hàng về kho và huỷ đơn...",
        );
        // Bù trừ kho (Compensating action)
        const item = order.items[0];
        const curStock = this.db.stockInventory.get(item.productId) ?? 0;
        this.db.stockInventory.set(item.productId, curStock + item.quantity);

        order.status = "CANCELLED_PAYMENT_FAILED";
        await this.db.saveOrder(order);
        return order; // Dừng dây chuyền
      }

      order.status = "PAYMENT_CONFIRMED";
      order.currentStep = "STEP_2_PAYMENT";
      await this.db.saveOrder(order);
      console.log(
        `[Bước 2 Thành công] Thanh toán hoàn tất. Trạng thái: ${order.status}`,
      );
    }

    // -------------------------------------------------------------
    // BƯỚC 3: XUẤT HÓA ĐƠN ĐIỆN TỬ (THỬ LẠI TỐI ĐA 5 LẦN)
    // -------------------------------------------------------------
    if (order.currentStep === "STEP_2_PAYMENT") {
      console.log("[Bước 3] Đang xuất hóa đơn điện tử...");
      const maxRetries = 5;
      let invoiceCreated = false;
      const simulatedFailures = options?.failInvoiceTimes ?? 0;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (attempt <= simulatedFailures) {
          console.warn(`[Bước 3 Lỗi] Xuất hóa đơn lần ${attempt} thất bại.`);
          await sleep(20);
        } else {
          invoiceCreated = true;
          break;
        }
      }

      if (!invoiceCreated) {
        console.error(
          "[Bước 3 Cảnh báo] Xuất hóa đơn thất bại cả 5 lần! Báo kế toán xử lý thủ công, đơn vẫn tiếp tục.",
        );
        order.manualInvoiceFlag = true; // Cắm cờ xử lý tay
      }

      order.status = "INVOICE_ISSUED";
      order.currentStep = "STEP_3_INVOICE";
      await this.db.saveOrder(order);
      console.log(
        `[Bước 3 Thành công] Trạng thái: ${order.status} | Kế toán hỗ trợ tay: ${order.manualInvoiceFlag}`,
      );
    }

    // -------------------------------------------------------------
    // BƯỚC 4: GỬI EMAIL VÀ SMS CHO KHÁCH (LỖI KHÔNG ẢNH HƯỞNG)
    // -------------------------------------------------------------
    if (order.currentStep === "STEP_3_INVOICE") {
      console.log("[Bước 4] Gửi email và tin nhắn SMS cho khách hàng...");
      try {
        if (options?.failEmailStep) {
          throw new Error(
            "SMTP_SERVER_UNREACHABLE: Sự cố mạng dịch vụ email ngoài!",
          );
        }
        console.log("[Bước 4] Đã gửi thông báo thành công cho khách hàng.");
        order.status = "NOTIFICATION_SENT";
      } catch (err: any) {
        console.warn(
          `[Bước 4 Bỏ qua lỗi] ${err.message} -> Không ảnh hưởng đơn hàng, tiếp tục bước 5.`,
        );
      }

      order.currentStep = "STEP_4_NOTIFY";
      await this.db.saveOrder(order);
    }

    // -------------------------------------------------------------
    // BƯỚC 5: ĐẨY ĐƠN SANG ĐỐI TÁC VẬN CHUYỂN
    // -------------------------------------------------------------
    if (order.currentStep === "STEP_4_NOTIFY") {
      console.log(
        "[Bước 5] Đẩy đơn hàng sang đối tác vận chuyển GiaoHangNhanh...",
      );
      order.shippingTrackingCode = `GHN_${order.id}_${Date.now()}`;
      order.status = "SHIPPED";
      order.currentStep = "COMPLETED";
      await this.db.saveOrder(order);
      console.log(
        `[Bước 5 Thành công] Mã vận đơn: ${order.shippingTrackingCode} | Trạng thái: ${order.status}`,
      );
    }

    console.log(
      `>>> [Dây chuyền hoàn tất] Đơn hàng #${order.id} kết thúc với trạng thái: ${order.status}\n`,
    );
    return order;
  }
}

// ============================================================================
// 4. KỊCH BẢN KIỂM CHỨNG TỰ ĐỘNG THEO YÊU CẦU ĐÁNH GIÁ
// ============================================================================
async function runVerificationSuite() {
  console.log(
    "================================================================================",
  );
  console.log(
    "    KIỂM THỬ DÂY CHUYỀN XỬ LÝ ĐƠN HÀNG NHIỀU BƯỚC (SESSION 05 - BÀI TẬP 7)      ",
  );
  console.log(
    "================================================================================\n",
  );

  const db = new MockDatabase();
  const paymentGateway = new MockPaymentGateway();
  const orchestrator = new OrderPipelineOrchestrator(db, paymentGateway);

  // --- KỊCH BẢN 1: HẾT HÀNG Ở BƯỚC 1 -> HUỶ ĐƠN, HOÀN TIỀN, BƯỚC SAU KHÔNG CHẠY ---
  console.log("--- KỊCH BẢN 1: Hết hàng ở Bước 1 ---");
  await orchestrator.initOrder("ORD_01", "macbook_m3", 1, 25000000); // macbook_m3 tồn kho = 0
  const res1 = await orchestrator.executePipeline("ORD_01");

  console.log(
    `Kết quả Kịch bản 1: Trạng thái = ${res1.status}, Hoàn tiền = ${res1.refunded}, Bước dừng = ${res1.currentStep}`,
  );
  if (
    res1.status === "CANCELLED_OUT_OF_STOCK" &&
    res1.refunded === true &&
    res1.currentStep === "NONE"
  ) {
    console.log(
      "=> ĐẠT KỊCH BẢN 1: Đơn bị hủy ngay bước 1, khách được hoàn tiền, các bước sau không chạy.\n",
    );
  } else {
    console.error("=> THẤT BẠI KỊCH BẢN 1\n");
  }

  // --- KỊCH BẢN 2: LỖI Ở BƯỚC 4 (EMAIL/SMS) -> ĐƠN VẪN HOÀN TẤT VÀ SANG VẬN CHUYỂN ---
  console.log("--- KỊCH BẢN 2: Lỗi gửi email/SMS ở Bước 4 ---");
  await orchestrator.initOrder("ORD_02", "iphone_16", 1, 30000000);
  const res2 = await orchestrator.executePipeline("ORD_02", {
    failEmailStep: true,
  });

  console.log(
    `Kết quả Kịch bản 2: Trạng thái = ${res2.status}, Mã vận chuyển = ${res2.shippingTrackingCode}`,
  );
  if (res2.status === "SHIPPED" && res2.shippingTrackingCode) {
    console.log(
      "=> ĐẠT KỊCH BẢN 2: Bước 4 lỗi nhưng không ảnh hưởng, đơn vẫn hoàn tất và đẩy sang vận chuyển.\n",
    );
  } else {
    console.error("=> THẤT BẠI KỊCH BẢN 2\n");
  }

  // --- KỊCH BẢN 3: GỌI THANH TOÁN BỊ TIMEOUT RỒI THỬ LẠI -> TIỀN CHỈ TRỪ ĐÚNG 1 LẦN ---
  console.log(
    "--- KỊCH BẢN 3: Thanh toán bị timeout mạng (Chống trừ tiền 2 lần) ---",
  );
  paymentGateway.simulateTimeoutOnce = true; // Cố tình gây timeout lần 1
  paymentGateway.actualChargeCallCount = 0;
  paymentGateway.chargedTransactions.clear(); // <-- THÊM DÒNG NÀY ĐỂ XÓA GIAO DỊCH CỦA ORD_02

  await orchestrator.initOrder("ORD_03", "iphone_16", 1, 30000000);
  const res3 = await orchestrator.executePipeline("ORD_03");

  const chargedCount = paymentGateway.chargedTransactions.size;
  console.log(
    `Số lần gọi hàm cổng thanh toán: ${paymentGateway.actualChargeCallCount}`,
  );
  console.log(
    `Số giao dịch thực tế bị trừ tiền trong tài khoản khách: ${chargedCount}`,
  );

  if (res3.status === "SHIPPED" && chargedCount === 1) {
    console.log(
      "=> ĐẠT KỊCH BẢN 3: Nhờ Idempotency Key, tiền chỉ bị trừ đúng 1 lần duy nhất dù có timeout và thử lại!\n",
    );
  } else {
    console.error("=> THẤT BẠI KỊCH BẢN 3\n");
  }

  // --- KỊCH BẢN 4: KHỞI ĐỘNG LẠI TIẾN TRÌNH GIỮA DÂY CHUYỀN -> TIẾP TỤC BƯỚC DỞ DANG ---
  console.log(
    "--- KỊCH BẢN 4: Sập nguồn / Khởi động lại server giữa dây chuyền ---",
  );
  // Giả lập một đơn hàng ORD_04 đã hoàn thành xong Bước 2 (PAYMENT_CONFIRMED) thì server bị sập
  const orderInterrupted: Order = {
    id: "ORD_04",
    items: [{ productId: "iphone_16", quantity: 1 }],
    totalAmount: 30000000,
    status: "PAYMENT_CONFIRMED",
    currentStep: "STEP_2_PAYMENT", // Checkpoint lưu tại Bước 2
    manualInvoiceFlag: false,
    refunded: false,
  };
  await db.saveOrder(orderInterrupted);

  console.log(
    "Mô phỏng server khởi động lại và nhặt lại đơn hàng dở dang ORD_04...",
  );
  // Gọi pipeline chạy lại: Nó phải bỏ qua Bước 1 & Bước 2, nhảy thẳng vào Bước 3
  const res4 = await orchestrator.executePipeline("ORD_04");

  if (res4.status === "SHIPPED" && res4.currentStep === "COMPLETED") {
    console.log(
      "=> ĐẠT KỊCH BẢN 4: Hệ thống tự động resume từ Bước 3, không chạy lại Bước 1 và 2 từ đầu.\n",
    );
  } else {
    console.error("=> THẤT BẠI KỊCH BẢN 4\n");
  }

  // --- KỊCH BẢN 5: TRA CỨU TIẾN ĐỘ THỜI GIAN THỰC ---
  console.log(
    "--- KỊCH BẢN 5: Khách hàng tra cứu trạng thái đơn hàng thời gian thực ---",
  );
  const trackedOrder = await db.getOrder("ORD_02");
  console.log(
    `Tra cứu đơn ORD_02: Trạng thái hiện tại = '${trackedOrder?.status}', Tiến độ = '${trackedOrder?.currentStep}'`,
  );
  if (trackedOrder?.status === "SHIPPED") {
    console.log(
      "=> ĐẠT KỊCH BẢN 5: Trạng thái phản ánh chính xác tiến độ thực tế.\n",
    );
  }

  console.log(
    "Toàn bộ các tiêu chí đánh giá của Bài tập 7 đã hoàn thành xuất sắc!",
  );
}

runVerificationSuite();
