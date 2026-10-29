const BASE_URL = "http://localhost:3000/products";

async function runTests() {
  console.log(
    "====================================================================",
  );
  console.log(
    "   BẮT ĐẦU KIỂM THỬ XÁC MINH VÁ LỖI BỘ NHỚ ĐỆM (SESSION 04 - EX05)   ",
  );
  console.log(
    "====================================================================\n",
  );

  // TEST 1: Mở sản phẩm A rồi mở sản phẩm B -> Đảm bảo không bị lẫn lộn dữ liệu
  console.log(
    "--- TEST 1: Kiểm tra phân biệt bản ghi giữa sản phẩm A và B ---",
  );
  const resA1 = await fetch(`${BASE_URL}/prod_A`).then((r) => r.json());
  console.log(
    `Lần 1 xem prod_A: [Từ Cache: ${resA1.fromCache}] -> Tên: "${resA1.product.name}" | Giá: ${resA1.product.price}`,
  );

  const resB = await fetch(`${BASE_URL}/prod_B`).then((r) => r.json());
  console.log(
    `Lần 1 xem prod_B: [Từ Cache: ${resB.fromCache}] -> Tên: "${resB.product.name}" | Giá: ${resB.product.price}`,
  );

  const resA2 = await fetch(`${BASE_URL}/prod_A`).then((r) => r.json());
  console.log(
    `Lần 2 xem lại prod_A: [Từ Cache: ${resA2.fromCache}] -> Tên: "${resA2.product.name}" | Giá: ${resA2.product.price}`,
  );

  if (resA2.product.id === "prod_A" && resB.product.id === "prod_B") {
    console.log(
      "=> KẾT QUẢ TEST 1: ĐẠT (Dữ liệu A và B độc lập hoàn toàn, không bị lẫn lộn)\n",
    );
  } else {
    console.log("=> KẾT QUẢ TEST 1: THẤT BẠI (Dữ liệu bị ghi đè lẫn nhau)\n");
  }

  // TEST 2: Cập nhật giá sản phẩm A rồi đọc tiếp theo -> Phải trả về giá mới ngay lập tức
  console.log("--- TEST 2: Cập nhật giá và kiểm tra vô hiệu hóa cache ---");
  console.log("Thực hiện: Đổi giá prod_A từ 100.000đ lên 180.000đ...");
  await fetch(`${BASE_URL}/prod_A`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ price: 180000 }),
  });

  const resAAfterUpdate = await fetch(`${BASE_URL}/prod_A`).then((r) =>
    r.json(),
  );
  console.log(
    `Đọc lại prod_A: [Từ Cache: ${resAAfterUpdate.fromCache}] -> Giá nhận được: ${resAAfterUpdate.product.price}đ`,
  );

  if (
    resAAfterUpdate.product.price === 180000 &&
    resAAfterUpdate.fromCache === false
  ) {
    console.log(
      "=> KẾT QUẢ TEST 2: ĐẠT (Cache cũ bị xoá ngay, lấy giá mới từ DB)\n",
    );
  } else {
    console.log("=> KẾT QUẢ TEST 2: THẤT BẠI (Vẫn phục vụ giá cũ)\n");
  }

  // TEST 3: Kiểm chứng bản ghi đệm có thời gian sống (TTL) hữu hạn
  console.log("--- TEST 3: Kiểm chứng thời gian sống (TTL) của khóa ---");
  const ttlRes = await fetch(`${BASE_URL}/prod_A/ttl`).then((r) => r.json());
  console.log(
    `Thời gian sống còn lại của cache prod_A: ${ttlRes.remainingTtlSeconds} giây`,
  );

  if (ttlRes.remainingTtlSeconds > 0 && ttlRes.remainingTtlSeconds <= 300) {
    console.log(
      "=> KẾT QUẢ TEST 3: ĐẠT (Khóa có TTL hữu hạn ~300s, không lưu vĩnh viễn)\n",
    );
  } else {
    console.log("=> KẾT QUẢ TEST 3: THẤT BẠI (Khóa không có thời gian sống)\n");
  }
}

runTests();
