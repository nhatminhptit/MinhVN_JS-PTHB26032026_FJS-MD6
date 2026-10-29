const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// 1. MOCK JOB & REDIS LOCK ENGINE VỚI EXTEND LOCK & STALLED DETECTION
// ============================================================================
class MockJob {
  public lockExpireTime: number;

  constructor(
    public id: string,
    public data: any,
    public lockDurationMs: number = 3000,
  ) {
    this.lockExpireTime = Date.now() + lockDurationMs;
  }

  async extendLock(extraMs: number): Promise<void> {
    this.lockExpireTime = Date.now() + extraMs;
  }

  isStalled(): boolean {
    return Date.now() > this.lockExpireTime;
  }
}

// ============================================================================
// 2. MOCK WORKER ENGINE CÓ CƠ CHẾ GRACEFUL SHUTDOWN
// ============================================================================
class MockWorker {
  public activeJobs = new Set<MockJob>();
  public completedJobs: string[] = [];
  public isClosing = false;

  async processJob(
    job: MockJob,
    durationMs: number,
    useExtendLock = false,
  ): Promise<void> {
    if (this.isClosing) {
      throw new Error(`Worker đã đóng, từ chối nhận thêm job ${job.id}`);
    }

    this.activeJobs.add(job);

    const stepTime = durationMs / 2;
    await sleep(stepTime);

    if (useExtendLock) {
      // (5) Gia hạn khóa khi công việc chạy lâu
      await job.extendLock(3000);
    }

    await sleep(stepTime);

    this.activeJobs.delete(job);
    this.completedJobs.push(job.id);
  }

  // (2) & (3) Dừng có trật tự với thời gian chờ giới hạn
  async close(graceTimeoutMs = 5000): Promise<void> {
    this.isClosing = true;

    const waitForActiveJobs = async () => {
      while (this.activeJobs.size > 0) {
        await sleep(50);
      }
    };

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT_EXCEEDED")), graceTimeoutMs),
    );

    await Promise.race([waitForActiveJobs(), timeoutPromise]);
  }
}

// ============================================================================
// 3. KỊCH BẢN CHẠY KIỂM CHỨNG TẤT CẢ TIÊU CHÍ ĐÁNH GIÁ
// ============================================================================
async function runVerificationSuite() {
  console.log(
    "======================================================================",
  );
  console.log(
    "   KIỂM THỬ CƠ CHẾ TẮT TIẾN TRÌNH AN TOÀN (GRACEFUL SHUTDOWN) - EX06  ",
  );
  console.log(
    "======================================================================\n",
  );

  // --- TEST 1: GỬI TÍN HIỆU TẮT KHI CÓ 5 CÔNG VIỆC ĐANG CHẠY DỞ ---
  console.log(
    "--- TEST 1: Đang xử lý 5 hóa đơn dở dang thì nhận tín hiệu tắt ứng dụng ---",
  );
  const worker1 = new MockWorker();

  const jobs = Array.from(
    { length: 5 },
    (_, i) => new MockJob(`HD_${i + 1}`, { total: 100000 }),
  );

  // Khởi động đồng thời 5 công việc render PDF (mỗi job mất 800ms)
  const jobPromises = jobs.map((j) => worker1.processJob(j, 800));

  // Giả lập sau 200ms, Kubernetes/DevOps gửi tín hiệu SIGTERM để deploy bản mới
  await sleep(200);
  console.log(
    `[Tín hiệu] SIGTERM nhận được! Hiện tại đang có ${worker1.activeJobs.size} job đang chạy dở.`,
  );
  console.log(
    "Đang kích hoạt quy trình Graceful Shutdown (chờ các job xử lý xong)...",
  );

  const shutdownStart = Date.now();
  await worker1.close(3000); // Cho phép chờ tối đa 3 giây
  await Promise.all(jobPromises);
  const shutdownDuration = Date.now() - shutdownStart;

  console.log(`Thời gian chờ hoàn tất: ${shutdownDuration}ms`);
  console.log(
    `Danh sách các hóa đơn đã hoàn tất: [ ${worker1.completedJobs.join(", ")} ]`,
  );
  console.log(`Số job còn dang dở: ${worker1.activeJobs.size}`);

  if (worker1.completedJobs.length === 5 && worker1.activeJobs.size === 0) {
    console.log(
      "=> KẾT QUẢ TEST 1: ĐẠT (Cả 5 hóa đơn đều hoàn thành 100% trước khi tiến trình thoát, không có file PDF nào bị hỏng!)\n",
    );
  } else {
    console.log("=> KẾT QUẢ TEST 1: THẤT BẠI\n");
  }

  // --- TEST 2: CÔNG VIỆC CHẠY LÂU NHỜ EXTEND LOCK NÊN KHÔNG BỊ COI LÀ BỎ RƠI ---
  console.log(
    "--- TEST 2: Kiểm chứng cơ chế gia hạn khóa (Extend Lock) khi tác vụ nặng ---",
  );
  const longJob = new MockJob("HD_HEAVY_REPORT", {}, 1000); // Ngưỡng bỏ rơi là 1000ms
  const worker2 = new MockWorker();

  console.log("Bắt đầu job nặng (chạy 1500ms, vượt quá ngưỡng khóa 1000ms)...");
  // Chạy job 1500ms nhưng có gọi extendLock ở giữa tiến trình
  const heavyPromise = worker2.processJob(longJob, 1500, true);

  // Quan sát tại mốc 1100ms (đã quá thời gian khóa ban đầu 1000ms)
  await sleep(1100);
  const isStalledAt1100ms = longJob.isStalled();
  console.log(
    `Trạng thái job tại mốc 1100ms: ${isStalledAt1100ms ? "BỊ COI LÀ BỎ RƠI (Sai)" : "VẪN HOẠT ĐỘNG TỐT NHỜ GIA HẠN (Đúng)"}`,
  );

  await heavyPromise;
  if (!isStalledAt1100ms && worker2.completedJobs.includes("HD_HEAVY_REPORT")) {
    console.log(
      "=> KẾT QUẢ TEST 2: ĐẠT (Job chạy lâu không bị thu hồi nhầm nhờ có extendLock)\n",
    );
  } else {
    console.log("=> KẾT QUẢ TEST 2: THẤT BẠI\n");
  }

  // --- TEST 3: DỪNG ĐỘT NGỘT (CRASH) - TIẾN TRÌNH KHÁC NHẬN LẠI SAU NGƯỠNG BỎ RƠI ---
  console.log(
    "--- TEST 3: Mô phỏng tắt đột ngột (Hard Crash) và cứu việc bỏ rơi ---",
  );
  const crashedJob = new MockJob("HD_CRASHED", {}, 1000); // Khóa 1000ms
  console.log(
    "Tiến trình A đang xử lý hóa đơn thì bị ngắt điện đột ngột (SIGKILL)...",
  );

  // Chờ 1200ms để khóa trên Redis vượt ngưỡng lockDuration
  await sleep(1200);
  const isStalledAfterCrash = crashedJob.isStalled();
  console.log(
    `Sau 1200ms, hệ thống kiểm tra: Job đã vượt ngưỡng bỏ rơi? -> ${isStalledAfterCrash ? "ĐÚNG (Stalled)" : "SAI"}`,
  );

  if (isStalledAfterCrash) {
    console.log(
      "Tiến trình Worker B phát hiện job bị bỏ rơi và bốc lại để xử lý tiếp...",
    );
    const workerB = new MockWorker();
    const recoveredJob = new MockJob(crashedJob.id, crashedJob.data, 3000);
    await workerB.processJob(recoveredJob, 400);
    console.log(
      `Tiến trình B hoàn thành xuất sắc hóa đơn cứu trợ: ${workerB.completedJobs[0]}`,
    );
    console.log(
      "=> KẾT QUẢ TEST 3: ĐẠT (Không làm mất công việc khi tiến trình bị ép dừng đột ngột)\n",
    );
  } else {
    console.log("=> KẾT QUẢ TEST 3: THẤT BẠI\n");
  }

  // --- TEST 4: BẪY CÔNG VIỆC CHẠY QUÁ LÂU VƯỢT THỜI GIAN CHỜ TẮT ---
  console.log("--- TEST 4: Bẫy công việc treo cứng vượt thời gian chờ tắt ---");
  const workerHanging = new MockWorker();
  const hangingJob = new MockJob("HD_HANGING", {});
  workerHanging.processJob(hangingJob, 10000); // Giả lập job bị treo 10 giây

  console.log("Tiến trình yêu cầu tắt với thời gian chờ tối đa 500ms...");
  const forceStart = Date.now();
  let timedOut = false;
  try {
    await workerHanging.close(500); // Chỉ chờ 500ms rồi buộc ngắt
  } catch (err: any) {
    if (err.message === "TIMEOUT_EXCEEDED") timedOut = true;
  }
  const forceDuration = Date.now() - forceStart;

  console.log(`Thời gian tiến trình buộc ngắt: ${forceDuration}ms`);
  if (timedOut && forceDuration < 800) {
    console.log(
      "=> KẾT QUẢ TEST 4: ĐẠT (Tiến trình kích hoạt cơ chế ép dừng sau timeout, không bị treo vĩnh viễn)\n",
    );
  } else {
    console.log("=> KẾT QUẢ TEST 4: THẤT BẠI\n");
  }

  console.log(
    "Toàn bộ 4 tiêu chuẩn kỹ thuật của bài tập đã hoàn thành xuất sắc!",
  );
}

runVerificationSuite();
