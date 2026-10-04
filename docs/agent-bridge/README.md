# Antigravity <-> Codex Local Bridge Protocol

Giao thức cầu nối cục bộ giữa Codex và phiên Antigravity hiện tại.

## 1. Thông Tin Phiên (Session Info)
* **Conversation ID:** `0c87a08a-40d3-4923-bd20-6db46d4bbe81`
* **Transport:** `agentapi.bat` (CLI môi trường cục bộ)
* **Xác thực:** Kế thừa tự động từ runtime của Antigravity (không lưu token, không để lộ bí mật).
* **Bảo mật:** Chỉ tiếp nhận nội dung trao đổi dạng văn bản (text messages); tuyệt đối không mở API thực thi mã/lệnh tùy ý. Không mở cổng mạng công khai.

---

## 2. Cấu Trúc Thư Mục
```text
docs/agent-bridge/
├── inbox/            # Nơi Codex gửi yêu cầu (request .json)
├── outbox/           # Nơi Antigravity ghi phản hồi (response .json)
├── processed/        # Lưu trữ yêu cầu đã xử lý (bảo đảm chỉ xử lý 1 lần)
├── status.json       # Trạng thái hiện tại của cầu nối (không chứa secret)
├── bridge.py         # Script điều phối và đánh thức Antigravity
├── start-bridge.ps1  # Script khởi động cầu nối
├── stop-bridge.ps1   # Script dừng cầu nối sạch sẽ
└── README.md         # Tài liệu hướng dẫn này
```

---

## 3. Định Dạng Bản Tin (Message Formats)

### Codex Gửi Yêu Cầu (Request):
Đặt tệp JSON vào thư mục `inbox/`, ví dụ `inbox/req_001.json`:
```json
{
  "id": "req_001",
  "sender": "codex",
  "title": "Bắt tay khởi tạo",
  "content": "Chào Antigravity, tôi là Codex. Hãy xác nhận kết nối bắt tay."
}
```

### Antigravity Trả Lời (Response):
Phản hồi sẽ được ghi vào `outbox/res_001.json`:
```json
{
  "id": "res_req_001",
  "reply_to": "req_001",
  "sender": "antigravity",
  "timestamp": "2026-09-18T14:35:00Z",
  "status": "success",
  "content": "Chào Codex, kết nối bắt tay thành công! Phiên Antigravity 0c87a08a-40d3-4923-bd20-6db46d4bbe81 đã sẵn sàng phối hợp."
}
```

---

## 4. Cách Điều Khiển Cầu Nối

* **Khởi động Daemon:**
  ```powershell
  .\start-bridge.ps1
  # Hoặc: python bridge.py --daemon
  ```
* **Xử lý 1 lần duy nhất (One-off / Sync):**
  ```powershell
  python bridge.py --once
  ```
* **Dừng cầu nối:**
  ```powershell
  .\stop-bridge.ps1
  # Hoặc: python bridge.py --stop
  ```
* **Kiểm tra trạng thái:**
  ```powershell
  python bridge.py --status
  # Hoặc đọc trực tiếp tệp status.json
  ```
