# 08 — Company: danh sách, chi tiết, chỉnh sửa

File: `Views/Company/Index.cshtml` (191 dòng), `Views/Company/Details.cshtml` (238), `Views/Company/Edit.cshtml` (210).

Đây là mặt tiền của doanh nghiệp trên nền tảng — chỗ nhà tuyển dụng nhìn vào để quyết định có tin sản phẩm này không.

## Hiện trạng đo được

| File | Dòng | CSS | `transition` | `:hover` | hex | token | `style=""` |
|---|---:|---:|---:|---:|---:|---:|---:|
| `Company/Index` | 191 | 12 | 1 | 2 | 4 | 1 | 18 |
| `Company/Details` | 238 | 4 | **0** | 1 | 1 | 1 | **23** |
| `Company/Edit` | 210 | **0** | **0** | **0** | 0 | **0** | 13 |

- `Index`: Hero Banner → Search Bar → Section Header → grid thẻ công ty với cover và **logo chồng mép** (`position-absolute`, `border-white`, `rounded-circle`).
- `Details`: gần như không có chất riêng, 23 inline style trên 238 dòng.
- `Edit`: form Bootstrap trần, **0 CSS, 0 token**.

## Lỗi cụ thể

1. **Thẻ công ty dựa hoàn toàn vào cover ảnh**: công ty chưa có ảnh đẹp thì thẻ trống trải, và không có phương án thay thế tử tế (không có ảnh mặc định theo thương hiệu).
2. **Logo chồng mép không có chiều sâu thật** — chỉ là viền trắng. Với một trang mà logo là nhân vật chính, đây là chỗ đáng đầu tư nhất.
3. **Details 0 transition**: chuyển tab, mở danh sách tin tuyển dụng của công ty — không phản hồi.
4. **Edit là form trần**: không có xem trước, nên doanh nghiệp không biết mình sẽ trông ra sao sau khi lưu.
5. Không skeleton cho grid; ảnh cover không đặt tỉ lệ → nhảy layout khi cuộn danh sách.

## Phải làm — mức tối thiểu

1. **Thẻ công ty có phương án không-ảnh**: nền sinh theo màu thương hiệu/chữ cái đầu, đủ đẹp để không cần cover.
2. **Ảnh cover đặt `aspect-ratio` cố định** + `loading="lazy"`; logo có bóng tiếp xúc và viền theo token, không phải viền trắng cứng.
3. **Details dựng lại theo cấp bậc**: khối danh tính công ty → mô tả → tin tuyển dụng đang mở (dùng chung card với Jobs) → thông tin phụ. Tab hoặc neo cuộn có phản hồi.
4. **Edit có xem trước trực tiếp**: chỉnh tên/logo/cover thấy ngay thẻ và trang chi tiết đổi theo. Đây là thứ biến một form thành công cụ.
5. Skeleton cho grid và cho danh sách tin của công ty; empty state khi công ty chưa có tin.
6. Gỡ inline style (18/23/13), áp token, `:focus-visible` cho thẻ bấm được.

## Một cử chỉ đặc trưng

**Logo "đóng dấu" lên cover** khi thẻ vào khung nhìn: logo hạ xuống vị trí chồng mép với một nhịp dừng dứt khoát và bóng đổ theo, như một con dấu. Một lần cho mỗi thẻ, không lặp. Không dùng cử chỉ này ở surface khác.

## Vượt trần

- **Trang công ty có nhịp như một trang giới thiệu thật**: dải số liệu (số tin đang tuyển, lĩnh vực, quy mô) lấy từ dữ liệu thật, đặt trong một khối có vật liệu riêng.
- **Edit là trình soạn thảo trực tiếp**: sửa ngay trên bản xem trước, không phải điền form rồi đoán.
- **Liên kết hai chiều mượt**: từ thẻ công ty ở Jobs sang trang công ty giữ được logo làm điểm neo.

## Nghiệm thu riêng

- Ảnh grid với ít nhất ba công ty: một có cover đẹp, một không có cover, một logo hình vuông — cả ba phải trông tử tế.
- Clip cử chỉ đóng dấu khi cuộn grid.
- Clip Edit → xem trước cập nhật theo.
- Ảnh trạng thái: grid rỗng, skeleton, có dữ liệu.
- Số đo: inline `style=""` 18/23/13 → ?, token 1/1/0 → ?
