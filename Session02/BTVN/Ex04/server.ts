import * as http from "http";

const server = http.createServer((req, res) => {
  if (req.url === "/dashboard-stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    console.log("[Server] Màn hình kho đã kết nối.");

    const keepAliveInterval = setInterval(() => {
      res.write(": heartbeat (keep load-balancer alive)\n\n");
      console.log("[Server] Đã gửi Ping giữ nhịp (chống sập 60s)");
    }, 45000);

    setTimeout(() => {
      res.write("event: warning\n");
      res.write(
        `data: ${JSON.stringify({ msg: "Kho A sắp hết thùng rác nhựa!", time: new Date().toISOString() })}\n\n`,
      );
    }, 5000);

    req.on("close", () => {
      clearInterval(keepAliveInterval);
      console.log("[Server] Màn hình kho đã ngắt kết nối.");
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3000, () => {
  console.log("[Server] Bảng điều khiển SSE chạy tại cổng 3000");
});
