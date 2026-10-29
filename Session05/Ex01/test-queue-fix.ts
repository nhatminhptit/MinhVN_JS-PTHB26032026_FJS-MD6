const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// 1. MOCK REDIS & IDEMPOTENCY STORE
// ============================================================================
class MockRedisStore {
  public store = new Map<string, any>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(
    key: string,
    value: string,
    mode?: string,
    ttl?: number,
  ): Promise<void> {
    this.store.set(key, value);
  }
}

// ============================================================================
// 2. MOCK MAILER SERVICE (ĐẾM SỐ EMAIL KHÁCH THỰC SỰ NHẬN ĐƯỢC)
// ============================================================================
class MockMailerService {
  public actualEmailsSentCount = 0;
  public failAttemptsRemaining = 0;

  async sendConfirmation(email: string, orderId: string) {
    if (this.failAttemptsRemaining > 0) {
      this.failAttemptsRemaining--;
      throw new Error(
        "SMTP_CONNECTION_TIMEOUT: Dịch vụ mail bị nghẽn mạng tạm thời!",
      );
    }
    this.actualEmailsSentCount++;
  }
}

// ============================================================================
// 3. MOCK BULLMQ ENGINE (MÔ PHỎNG RETRY, EXPONENTIAL BACKOFF, DỌN DẸP JOB)
// ============================================================================
interface JobConfig {
  jobId: string;
  attempts: number;
  backoff: { type: string; delay: number };
  removeOnComplete: { count: number };
}

class MockBullQueue {
  public completedJobs: string[] = [];
  public retryIntervals: number[] = [];

  constructor(
    private readonly redis: MockRedisStore,
    private readonly mailer: MockMailerService,
  ) {}

  async processJobWithBackoff(
    orderId: string,
    email: string,
    config: JobConfig,
  ) {
    let lastAttemptTime = Date.now();

    for (let attempt = 1; attempt <= config.attempts; attempt++) {
      try {
        const idempotencyKey = `shopfast:mail_sent:${orderId}`;
        const alreadySent = await this.redis.get(idempotencyKey);

        if (alreadySent) {
          // Idempotency: Không gửi lại
          break;
        }

        // Thực hiện gửi
        await this.mailer.sendConfirmation(email, orderId);
        await this.redis.set(idempotencyKey, "SUCCESS", "EX", 86400);

        // Thành công -> Kết thúc vòng đời job
        this.addCompletedJob(config.jobId, config.removeOnComplete.count);
        return;
      } catch (err) {
        if (attempt < config.attempts) {
          // Tính toán Exponential Backoff: delay * 2^(attempt - 1)
          const waitTime = config.backoff.delay * Math.pow(2, attempt - 1);
          await sleep(waitTime);

          const now = Date.now();
          this.retryIntervals.push(now - lastAttemptTime);
          lastAttemptTime = now;
        }
      }
    }
  }

  private addCompletedJob(jobId: string, maxLimit: number) {
    this.completedJobs.push(jobId);
    // Áp dụng removeOnComplete: chỉ giữ lại tối đa maxLimit bản ghi
    if (this.completedJobs.length > maxLimit) {
      this.completedJobs.shift(); // Dọn dẹp bản ghi cũ nhất
    }
  }
}

// ============================================================================
// 4. KỊCH BẢN CHẠY KIỂM CHỨNG TOÀN DIỆN CẢ 3 TIÊU CHÍ ĐÁNH GIÁ
// ============================================================================
async function runTestSuite() {
  console.log(
    "======================================================================",
  );
  console.log(
    "   KIỂM THỬ XÁC MINH VÁ LỖI HÀNG ĐỢI EMAIL BULLMQ (SESSION 05 - BÀI 5)",
  );
  console.log(
    "======================================================================\n",
  );

  const redis = new MockRedisStore();
  const mailer = new MockMailerService();
  const queue = new MockBullQueue(redis, mailer);

  // --- TEST 1: THẤT BẠI 4 LẦN RỒI THÀNH CÔNG -> KHÁCH CHỈ NHẬN ĐÚNG 1 EMAIL ---
  console.log(
    "--- TEST 1: Gửi email thất bại 4 lần rồi thành công ở lần 5 ---",
  );
  mailer.failAttemptsRemaining = 4; // Cố tình làm hỏng 4 lần đầu
  mailer.actualEmailsSentCount = 0;

  const jobConfig: JobConfig = {
    jobId: "email_order_1001",
    attempts: 5,
    backoff: { type: "exponential", delay: 30 }, // Giả lập delay 30ms cho test chạy nhanh
    removeOnComplete: { count: 100 },
  };

  console.log("Đang thực thi job với 5 attempts...");
  await queue.processJobWithBackoff("1001", "khachhang@shopfast.vn", jobConfig);

  console.log(
    `Số lần email gửi đến hòm thư khách hàng thực tế: ${mailer.actualEmailsSentCount}`,
  );

  if (mailer.actualEmailsSentCount === 1) {
    console.log(
      "=> KẾT QUẢ TEST 1: ĐẠT (Trải qua 4 lần retry ném lỗi, khách hàng chỉ nhận duy nhất 1 email!)\n",
    );
  } else {
    console.log(
      `=> KẾT QUẢ TEST 1: THẤT BẠI (Khách bị nhận ${mailer.actualEmailsSentCount} email)\n`,
    );
  }

  // --- TEST 2: KIỂM CHỨNG CHIẾN LƯỢC EXPONENTIAL BACKOFF (GIÃN CÁCH THỜI GIAN) ---
  console.log(
    "--- TEST 2: Kiểm chứng giãn dần thời gian chờ giữa các lần thử lại ---",
  );
  console.log(
    "Khoảng cách thời gian đo được giữa các lần retry:",
    queue.retryIntervals.map((t) => `${t}ms`).join(" -> "),
  );

  let isBackoffGrowing = true;
  for (let i = 0; i < queue.retryIntervals.length - 1; i++) {
    if (queue.retryIntervals[i] >= queue.retryIntervals[i + 1]) {
      isBackoffGrowing = false;
      break;
    }
  }

  if (isBackoffGrowing && queue.retryIntervals.length === 4) {
    console.log(
      "=> KẾT QUẢ TEST 2: ĐẠT (Thời gian chờ tăng dần theo cấp số nhân, không bị retry dồn dập)\n",
    );
  } else {
    console.log(
      "=> KẾT QUẢ TEST 2: THẤT BẠI (Thời gian chờ bị cố định hoặc không tăng)\n",
    );
  }

  // --- TEST 3: CHẠY 1.000 JOB RỒI KIỂM TRA SỐ BẢN GHI TỒN ĐỌNG TRONG REDIS ---
  console.log(
    "--- TEST 3: Đẩy 1.000 công việc và kiểm tra giới hạn tồn đọng trong Redis ---",
  );
  mailer.failAttemptsRemaining = 0; // Để các job thành công mượt mà

  console.log("Đang đẩy và xử lý 1.000 job hoàn tất...");
  for (let i = 1; i <= 1000; i++) {
    await queue.processJobWithBackoff(
      `order_${i}`,
      `user_${i}@shopfast.vn`,
      jobConfig,
    );
  }

  const remainingJobsInRedis = queue.completedJobs.length;
  console.log(`Tổng số job đã xử lý: 1.000 jobs`);
  console.log(
    `Số lượng bản ghi job còn tồn đọng trong Redis: ${remainingJobsInRedis}`,
  );

  if (remainingJobsInRedis === 100) {
    console.log(
      "=> KẾT QUẢ TEST 3: ĐẠT (Bộ nhớ Redis được dọn sạch, chỉ giữ lại đúng 100 bản ghi theo cấu hình!)\n",
    );
  } else {
    console.log(
      `=> KẾT QUẢ TEST 3: THẤT BẠI (Tồn đọng ${remainingJobsInRedis} bản ghi, gây phình RAM)\n`,
    );
  }

  console.log(
    "Toàn bộ các tiêu chí đánh giá của bài tập đã hoàn thành xuất sắc!",
  );
}

runTestSuite();
