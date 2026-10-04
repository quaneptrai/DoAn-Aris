**Tiếp quản phiên:** đọc [SESSION-HANDOFF.md](../SESSION-HANDOFF.md) trước.

> **19/09/2026 — bản định hướng hiện hành là [UI-PLAN-V2-CONSTELLATION.md](UI-PLAN-V2-CONSTELLATION.md).**
> Nó thay phần định hướng của `PLAN.md` và `AGY-INSTRUCTION-WORLD-CLASS.md`: baseline không còn là V5 nano-card, workspace không còn nền sáng, và mô-típ nhận diện đã chuyển sang **chòm sao**. Phần cấu trúc của bộ cũ (nhất là bảng phân bổ chuyển động trong `surface-briefs/00-INDEX.md`) vẫn còn giá trị và được giữ.
> Triển khai auth đã làm: [NANO-AUTH-IMPLEMENTATION.md](NANO-AUTH-IMPLEMENTATION.md).

# Plan cho AGY — phát triển từ login V5

**Baseline người dùng chỉ định:** `docs/design-lab/aris-login-v5`. Giữ trải nghiệm 3D DNA → ARIS → nano-card. Nâng chất liệu, spacing, typography, mode morph và đưa vào login/register thật.

1. [AGY-INSTRUCTION-WORLD-CLASS.md](AGY-INSTRUCTION-WORLD-CLASS.md) — **bản giao việc chính**: hai vế (UI bên trong + làm lại đăng nhập/đăng ký), hiện trạng đo được, ranh giới, cổng tối thiểu và phần được chấm thật.
2. [surface-briefs/](surface-briefs/00-INDEX.md) — brief riêng cho từng bề mặt (11 file), kèm bảng đo toàn bộ view và luật phân bổ chuyển động.
3. [V5-REFERENCE-REVIEW.md](V5-REFERENCE-REVIEW.md) — ảnh mới, điều đã chạy và đánh giá cụ thể phần đẹp/cần sửa của V5.
4. [V5-NANO-IDENTITY-DIRECTIVE.md](V5-NANO-IDENTITY-DIRECTIVE.md) — **chỉ thị mới nhất**: card phải LÀ hạt nano, morph do hạt dựng lại, cảnh phải bủng nổ hơn. Ưu tiên cao hơn phần "một mặt phẳng" trong brief dưới.
5. [V5-CARD-UPGRADE-BRIEF.md](V5-CARD-UPGRADE-BRIEF.md) — nguyên nhân gốc ở mức code của wordmark bị chia băng, mặt card dạng chăn bông và viền hạt; kèm bẫy ràng buộc và cổng nghiệm thu.
6. [AGY-HANDOFF.md](AGY-HANDOFF.md) — hướng đã hiệu chỉnh cho auth, Dashboard, animation, thứ tự làm và nghiệm thu. Có prompt giao việc.
7. [PLAN.md](PLAN.md) — inventory, token/component, file mapping; các nhận xét audit cũ là snapshot, không thay thế source mới.
8. [contrast.md](contrast.md) — phép đo palette đề xuất.

**`preview.html` là study đã bị bác bỏ về hướng thẩm mỹ. Không dùng nó làm mẫu triển khai auth hoặc thay thế scene V5.** `theme-tokens.css` chỉ là token nháp, chưa là visual design hoàn chỉnh.

Phạm vi phiên hiệu chỉnh này: chỉ đọc source, chạy V5 trong browser riêng và cập nhật tài liệu. Không sửa app, không restart server, không submit auth, không gửi chỉ dẫn trực tiếp cho AGY qua công cụ khác.
