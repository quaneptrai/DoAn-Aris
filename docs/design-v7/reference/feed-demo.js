/* =============================================================================
   ARIS LINE — Bảng tin (kiểu Instagram): MÔ PHỎNG TƯƠNG TÁC (bản thiết kế V7)
   Endpoint CÓ SẴN trong app (DashboardController):
     GET  /Dashboard/Index                 → 10 bài mới nhất (ViewBag.Posts, LikedPostIds)
     POST /Dashboard/CreatePost            (content, title, mediaFiles[]) → { success, data }
     POST /Dashboard/ToggleLike            (postId) → { success, liked, likeCount }
     GET  /Dashboard/GetComments?postId=   → [{ id, username, avatar, content, createdAt }]
     POST /Dashboard/AddComment            (postId, content) → { success, commentCount, comment }
     POST /Dashboard/EditPost              (id, content, title) · DELETE /Dashboard/DeletePost/{id}
     GET  /Dashboard/GetLiveStats          → { activeJobCount, onlineFriendsCount }
     Friends: SendRequest / CancelRequest / AcceptRequest / DeclineRequest
     JobApplications: GetInterviewInvitations / RespondToInterview(applicationId, accept)
     ChatHub.SendMessage (gửi bài cho bạn bè, trả lời tin 24h)
   Mọi thứ đánh dấu [CẦN BACKEND] là tính năng mới — xem README mục "Bảng tin".
   Dữ liệu dưới đây là DỮ LIỆU MẪU.
   ============================================================================= */
(function () {
  'use strict';
  const M = window.ArisMotion;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isMobile = () => matchMedia('(max-width: 767px)').matches;
  const params = new URLSearchParams(location.search);
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /* Giả lập gọi API: app thật thay bằng fetch() tới endpoint ghi ở từng chỗ */
  const api = (ms = 450, fail = false) => new Promise((res, rej) => setTimeout(() => (fail ? rej(new Error('offline')) : res()), ms));
  const autosize = (ta, max = 9999) => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, max) + 'px'; };
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  let nid = 500;

  /* ---------------------------------------------------------------------------
     ẢNH MẪU (SVG vẽ tay — thay cho ảnh người dùng tải lên)
     --------------------------------------------------------------------------- */
  const SCENES = {
    office: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><rect width='400' height='500' fill='#E4E7EC'/><g fill='#C9D3DF'><rect x='24' y='40' width='110' height='170'/><rect x='146' y='40' width='110' height='170'/><rect x='268' y='40' width='110' height='170'/></g><g fill='#AFBBCB'><rect x='24' y='140' width='24' height='70'/><rect x='56' y='110' width='30' height='100'/><rect x='94' y='150' width='40' height='60'/><rect x='146' y='120' width='34' height='90'/><rect x='190' y='95' width='26' height='115'/><rect x='224' y='135' width='32' height='75'/><rect x='268' y='105' width='40' height='105'/><rect x='316' y='145' width='30' height='65'/><rect x='352' y='125' width='26' height='85'/></g><rect y='300' width='400' height='200' fill='#CDBBA0'/><rect x='30' y='270' width='220' height='14' rx='4' fill='#8A6A4C'/><rect x='50' y='284' width='10' height='70' fill='#6E5540'/><rect x='220' y='284' width='10' height='70' fill='#6E5540'/><rect x='70' y='226' width='80' height='46' rx='4' fill='#2F3542'/><rect x='104' y='272' width='12' height='8' fill='#2F3542'/><rect x='160' y='240' width='56' height='30' rx='3' fill='#3E4757'/><circle cx='320' cy='238' r='30' fill='#6F8F6B'/><circle cx='300' cy='220' r='22' fill='#86A682'/><rect x='306' y='262' width='28' height='40' rx='4' fill='#8C6F52'/><circle cx='120' cy='380' r='26' fill='#55606F'/><rect x='88' y='404' width='64' height='96' rx='28' fill='#55606F'/><circle cx='270' cy='372' r='24' fill='#6B5B4B'/><rect x='240' y='394' width='60' height='106' rx='28' fill='#7C6A5A'/></svg>`,
    team: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><rect width='400' height='500' fill='#EFEAE2'/><rect x='40' y='50' width='320' height='190' rx='6' fill='#FFFFFF' stroke='#CFC8BC' stroke-width='4'/><rect x='70' y='80' width='56' height='56' rx='3' fill='#F1D88E'/><rect x='150' y='90' width='80' height='56' rx='3' fill='#CFE2C4'/><rect x='250' y='150' width='56' height='56' rx='3' fill='#C9D8EE'/><path d='M80 196 C 140 166, 200 226, 320 186' stroke='#2F6FED' stroke-width='5' fill='none' stroke-linecap='round'/><circle cx='90' cy='330' r='34' fill='#6B5B4B'/><rect x='46' y='362' width='88' height='138' rx='40' fill='#3E5C76'/><circle cx='200' cy='316' r='36' fill='#3A3029'/><rect x='152' y='350' width='96' height='150' rx='44' fill='#C06A4B'/><circle cx='310' cy='334' r='32' fill='#8C6F52'/><rect x='268' y='364' width='84' height='136' rx='38' fill='#5E7B5A'/></svg>`,
    whiteboard: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><rect width='400' height='500' fill='#F3F0E9'/><rect x='40' y='50' width='96' height='96' rx='4' fill='#F1D88E'/><rect x='156' y='70' width='96' height='96' rx='4' fill='#CFE2C4'/><rect x='270' y='44' width='96' height='96' rx='4' fill='#F2C6B6'/><rect x='70' y='190' width='96' height='96' rx='4' fill='#C9D8EE'/><rect x='200' y='200' width='96' height='96' rx='4' fill='#F1D88E'/><rect x='110' y='330' width='96' height='96' rx='4' fill='#F2C6B6'/><rect x='240' y='340' width='96' height='96' rx='4' fill='#CFE2C4'/><g stroke='#6B6457' stroke-width='5' stroke-linecap='round' opacity='.55'><path d='M58 80h56M58 100h38M174 100h56M174 120h32M288 74h56M288 94h40M88 220h54M88 240h34M218 230h56M218 250h36M128 360h54M128 380h30M258 370h56M258 390h38'/></g></svg>`,
    desk: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><rect width='400' height='500' fill='#E9E3D8'/><rect x='230' y='40' width='140' height='180' fill='#D7E3EA'/><path d='M300 40v180M230 130h140' stroke='#C2B8A6' stroke-width='6'/><rect y='330' width='400' height='170' fill='#B89A77'/><rect y='322' width='400' height='14' fill='#9E7F5E'/><rect x='80' y='170' width='190' height='120' rx='8' fill='#23272F'/><g stroke-linecap='round' stroke-width='6'><path d='M100 196h60' stroke='#8FB3D9'/><path d='M112 214h90' stroke='#D9C38F'/><path d='M112 232h70' stroke='#9FCBA8'/><path d='M100 250h110' stroke='#8FB3D9'/><path d='M112 268h50' stroke='#D9A38F'/></g><rect x='166' y='290' width='18' height='26' fill='#23272F'/><rect x='136' y='314' width='78' height='10' rx='4' fill='#23272F'/><rect x='90' y='342' width='130' height='18' rx='4' fill='#E8E4DC'/><path d='M330 320 L 334 232 L 304 204' stroke='#3A3D44' stroke-width='6' fill='none'/><path d='M280 196 l40 -10 l6 30 z' fill='#3A3D44'/><circle cx='52' cy='270' r='30' fill='#6F8F6B'/><circle cx='36' cy='250' r='20' fill='#86A682'/><rect x='38' y='290' width='30' height='36' rx='4' fill='#C4A27E'/><rect x='250' y='332' width='28' height='32' rx='5' fill='#F4F1EA'/><path d='M278 340 q12 4 0 14' stroke='#F4F1EA' stroke-width='5' fill='none'/></svg>`,
    cert: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='#DDE3EA'/><g transform='rotate(-3 200 200)'><rect x='60' y='70' width='280' height='260' rx='6' fill='#FFFFFF'/><rect x='74' y='84' width='252' height='232' rx='3' fill='none' stroke='#C6D2E6' stroke-width='3'/><rect x='130' y='112' width='140' height='12' rx='4' fill='#2F6FED' opacity='.8'/><rect x='110' y='140' width='180' height='8' rx='4' fill='#B7BDC7'/><rect x='150' y='176' width='100' height='16' rx='4' fill='#3A3D44'/><rect x='104' y='210' width='192' height='7' rx='3' fill='#CBD0D8'/><rect x='124' y='226' width='152' height='7' rx='3' fill='#CBD0D8'/><circle cx='280' cy='278' r='26' fill='#E8B64C'/><circle cx='280' cy='278' r='18' fill='none' stroke='#FFFFFF' stroke-width='3'/><path d='M112 282h80' stroke='#8A909A' stroke-width='3'/></g></svg>`,
    meetup: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#ECE6DB'/><rect x='70' y='34' width='260' height='150' rx='6' fill='#2F3542'/><g fill='#8FB3D9'><rect x='96' y='62' width='130' height='12' rx='3'/><rect x='96' y='90' width='190' height='8' rx='3' opacity='.6'/><rect x='96' y='108' width='160' height='8' rx='3' opacity='.6'/><rect x='96' y='126' width='175' height='8' rx='3' opacity='.6'/></g><g fill='#5D6B7B'><circle cx='60' cy='250' r='26'/><circle cx='130' cy='262' r='28'/><circle cx='205' cy='252' r='26'/><circle cx='280' cy='262' r='28'/><circle cx='350' cy='250' r='26'/></g></svg>`,
    notes: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#F3F0E9'/><rect x='40' y='40' width='92' height='92' rx='4' fill='#F1D88E'/><rect x='150' y='56' width='92' height='92' rx='4' fill='#CFE2C4'/><rect x='262' y='36' width='92' height='92' rx='4' fill='#F2C6B6'/><rect x='92' y='160' width='92' height='92' rx='4' fill='#C9D8EE'/><rect x='214' y='170' width='92' height='92' rx='4' fill='#F1D88E'/><g stroke='#6B6457' stroke-width='5' stroke-linecap='round' opacity='.55'><path d='M58 70h52M58 90h36M168 86h52M168 106h30M280 66h52M280 86h40M110 190h50M110 210h32M232 200h52M232 220h36'/></g></svg>`,
    city: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><rect width='400' height='500' fill='#D9DEE8'/><rect y='170' width='400' height='130' fill='#E6D9CF'/><circle cx='300' cy='205' r='40' fill='#F0C9A8'/><g fill='#8C97AA'><rect x='0' y='250' width='50' height='250'/><rect x='56' y='200' width='60' height='300'/><rect x='122' y='270' width='44' height='230'/><rect x='172' y='150' width='54' height='350'/><rect x='232' y='230' width='48' height='270'/><rect x='286' y='190' width='62' height='310'/><rect x='354' y='260' width='46' height='240'/></g><g fill='#F3E2B5' opacity='.85'><rect x='66' y='222' width='10' height='12'/><rect x='92' y='250' width='10' height='12'/><rect x='184' y='176' width='10' height='12'/><rect x='204' y='214' width='10' height='12'/><rect x='184' y='262' width='10' height='12'/><rect x='298' y='214' width='10' height='12'/><rect x='322' y='250' width='10' height='12'/><rect x='244' y='260' width='10' height='12'/></g><rect y='440' width='400' height='60' fill='#5E6A7E'/></svg>`,
    coffee: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><rect width='400' height='500' fill='#C9AE8C'/><g stroke='#B89A77' stroke-width='3'><path d='M0 80h400M0 190h400M0 300h400M0 410h400'/></g><rect x='40' y='250' width='190' height='200' rx='6' fill='#F4F1EA' transform='rotate(-8 135 350)'/><g stroke='#C9C3B6' stroke-width='4' stroke-linecap='round' transform='rotate(-8 135 350)'><path d='M70 300h120M70 330h130M70 360h100M70 390h120'/></g><rect x='210' y='360' width='120' height='10' rx='5' fill='#2F3542' transform='rotate(-30 270 365)'/><circle cx='270' cy='170' r='92' fill='#EDE8DF'/><circle cx='270' cy='170' r='62' fill='#FFFFFF'/><circle cx='270' cy='170' r='48' fill='#6B4A33'/><path d='M252 160 q18 -18 36 0 q-18 18 -36 0z' fill='#C9A27E'/><rect x='332' y='150' width='40' height='22' rx='11' fill='#FFFFFF'/></svg>`,
    code: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 640'><rect width='360' height='640' fill='#1E2128'/><g stroke-linecap='round' stroke-width='8'><path d='M40 120h90' stroke='#8FB3D9'/><path d='M60 150h160' stroke='#D9C38F'/><path d='M60 180h120' stroke='#9FCBA8'/><path d='M80 210h180' stroke='#8FB3D9'/><path d='M80 240h90' stroke='#D9A38F'/><path d='M60 270h40' stroke='#8FB3D9'/><path d='M40 300h20' stroke='#8FB3D9'/><path d='M40 360h110' stroke='#C2A5E0'/><path d='M60 390h200' stroke='#9FCBA8'/><path d='M60 420h150' stroke='#D9C38F'/><path d='M80 450h120' stroke='#8FB3D9'/><path d='M60 480h60' stroke='#D9A38F'/><path d='M40 510h20' stroke='#C2A5E0'/></g></svg>`
  };
  const scene = (k) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SCENES[k]);
  const mediaSrc = (m) => m.src || scene(m.s);
  const mediaEl = (m, alt = '') => (m.kind === 'video'
    ? `<video src="${mediaSrc(m)}" muted playsinline loop autoplay></video>`
    : `<img src="${mediaSrc(m)}" alt="${esc(m.alt || alt)}" draggable="false">`);

  /* ---------------------------------------------------------------------------
     DỮ LIỆU MẪU
     --------------------------------------------------------------------------- */
  const PEOPLE = {
    me: { id: 1, name: 'Đặng Khoa', role: 'Frontend Developer · TP.HCM' },
    ma: { id: 11, name: 'Nguyễn Minh Anh', role: 'Tuyển dụng · TechNova', mutual: 6, friend: true },
    ha: { id: 12, name: 'Lê Thu Hà', role: 'Product Designer · Lumen Studio', mutual: 8, friend: true },
    huy: { id: 13, name: 'Phạm Gia Huy', role: 'Backend Developer · Nexa Pay', mutual: 12, friend: true },
    linh: { id: 14, name: 'Đỗ Khánh Linh', role: 'Sinh viên năm 4 · ĐH Bách khoa', mutual: 3, friend: true },
    nam: { id: 15, name: 'Vũ Hoàng Nam', role: 'QA Engineer', mutual: 2, friend: true },
    phuong: { id: 16, name: 'Hoàng Mai Phương', role: 'Kế toán · Sao Mai Retail', mutual: 5, friend: true },
    thinh: { id: 17, name: 'Trần Đức Thịnh', role: 'Mobile Developer', mutual: 4, friend: true },
    tuan: { id: 21, name: 'Lý Minh Tuấn', role: 'Data Engineer · Sao Mai Retail', mutual: 9 },
    vy: { id: 22, name: 'Ngô Tường Vy', role: 'UI Designer', mutual: 4 },
    quang: { id: 23, name: 'Bùi Nhật Quang', role: 'Tech Lead · TechNova', mutual: 7 },
    trang: { id: 24, name: 'Phan Thu Trang', role: 'HR · GreenLeaf Foods', mutual: 2 },
    an: { id: 25, name: 'Trịnh Bảo An', role: 'DevOps · Nexa Pay', mutual: 5 },
    technova: { id: 101, name: 'TechNova', role: 'Công ty · 12 việc đang tuyển', org: true },
    nexa: { id: 102, name: 'Nexa Pay', role: 'Công ty · 6 việc đang tuyển', org: true },
    lumen: { id: 103, name: 'Lumen Studio', role: 'Công ty · 4 việc đang tuyển', org: true }
  };
  const FRIENDS = () => Object.keys(PEOPLE).filter((k) => PEOPLE[k].friend);
  const keyOf = (name) => Object.keys(PEOPLE).find((k) => PEOPLE[k].name === name);
  const shortName = (k) => (PEOPLE[k].org ? PEOPLE[k].name : PEOPLE[k].name.split(' ').slice(-2).join(' '));

  const C = (who, text, mins, likes = 0, replies = []) => ({ id: nid++, who, text, mins, likes, liked: false, replies });
  const P = (o) => Object.assign({ mins: 0, title: null, text: '', media: null, ar: '4 / 5', poll: null, job: null, likes: 0, liked: false, saved: false, likedBy: [], comments: [] }, o);
  const POSTS = [
    P({ id: 1, who: 'technova', mins: 120, media: [{ s: 'office' }, { s: 'team' }, { s: 'whiteboard' }],
      text: 'Một ngày ở văn phòng Quận 1 của TechNova 👋 Nhóm sản phẩm đang tìm thêm 2 bạn Frontend cùng xây bảng điều khiển bán hàng cho hơn 3.000 cửa hàng. Bạn nào quan tâm cứ ứng tuyển trực tiếp bên dưới, hoặc nhắn @Nguyễn Minh Anh nhé. #TechNova #TuyenDung #Frontend',
      job: { id: 1, title: 'Frontend Developer (React)', salary: '25–35 triệu', city: 'TP.HCM', mode: 'Hybrid' },
      likes: 128, likedBy: ['ha', 'huy'],
      comments: [C('ha', 'Văn phòng đẹp quá! Có chỗ cho designer không ạ 😄', 110, 5, [C('ma', '@Lê Thu Hà có nha, tuần sau bên mình mở thêm vị trí Product Designer.', 95, 2)]), C('huy', 'Team frontend bên này dùng Next hay Vite vậy anh?', 60, 2), C('nam', 'Mình vừa ứng tuyển, mong được phản hồi 🙏', 40, 1)] }),
    P({ id: 2, who: 'ha', mins: 300, media: [{ s: 'desk' }], liked: true, likes: 46, likedBy: ['linh', 'phuong'],
      text: 'Góc làm việc mới sau tuần đầu ở Lumen Studio. Cảm ơn mọi người đã giới thiệu cho mình cơ hội này 🙏',
      comments: [C('linh', 'Chúc mừng chị! Góc làm việc xịn quá 😍', 280, 3), C('huy', 'Đèn này mua ở đâu vậy Hà?', 200, 1, [C('ha', '@Phạm Gia Huy mình mua online, tối gửi link nha.', 190, 1)])] }),
    P({ id: 3, who: 'huy', mins: 1320, title: '3 điều mình học được sau 100 buổi review code', likes: 214, likedBy: ['ha', 'thinh'],
      text: 'Sau hơn 100 buổi review code cho nhóm backend ở Nexa Pay, đây là 3 điều mình thấy có ích nhất:\n\n1. Review sớm và nhỏ. Một pull request dưới 300 dòng được đọc kỹ hơn nhiều so với một PR 2.000 dòng.\n\n2. Hỏi thay vì ra lệnh. "Mình nghĩ chỗ này dùng Dictionary sẽ gọn hơn, bạn thấy sao?" dễ nghe hơn "Sửa thành Dictionary".\n\n3. Tách việc bắt lỗi khỏi việc góp ý định dạng. Để công cụ lo phần định dạng, con người tập trung vào logic và thiết kế.\n\nCòn các bạn thì sao? #CodeReview #Backend',
      comments: [C('thinh', 'Ý thứ 2 chuẩn luôn, review nhỏ và thường xuyên đỡ mệt hơn nhiều.', 1200, 12), C('linh', 'Anh có checklist review không ạ, cho em xin với 🙏', 1100, 4, [C('huy', '@Đỗ Khánh Linh để anh viết thành một bài riêng nhé.', 1050, 6)]), C('ma', 'Bài hay, mình chia sẻ cho nhóm TechNova rồi nha.', 900, 3)] }),
    P({ id: 4, who: 'linh', mins: 1500, likes: 37, likedBy: ['huy'],
      text: 'Mọi người cho em xin ý kiến với ạ, em đang phân vân giữa 2 nơi 🥲',
      poll: { q: 'Sinh viên năm cuối nên ưu tiên gì khi chọn nơi thực tập?', opts: [['Có người hướng dẫn kèm', 89], ['Được làm dự án thật', 43], ['Phụ cấp tốt', 32], ['Công ty tên tuổi', 22]], voted: null, days: 2 },
      comments: [C('huy', 'Chọn nơi có mentor, năm đầu học được nhiều nhất là từ người hướng dẫn.', 1400, 9), C('phuong', 'Đồng ý với Huy. Phụ cấp thực tập chênh nhau không nhiều đâu em.', 1350, 4)] }),
    P({ id: 5, who: 'me', mins: 2880, media: [{ s: 'cert' }], ar: '1 / 1', likes: 23, likedBy: ['ha', 'huy'],
      text: 'Vừa hoàn thành khoá Web Performance 🎉 Điểm Lighthouse của dự án cá nhân từ 61 lên 97 sau khi áp dụng những gì học được.',
      comments: [C('ha', 'Đỉnh quá Khoa ơi 👏', 2800, 2), C('huy', '97 thì phải chia sẻ bí kíp đi', 2700, 3, [C('me', '@Phạm Gia Huy chủ yếu là tối ưu ảnh với chia nhỏ JS thôi anh 😄', 2650, 2)])] }),
    P({ id: 6, who: 'phuong', mins: 4300, media: [{ s: 'meetup' }, { s: 'notes' }], ar: '4 / 3', likes: 57, likedBy: ['linh'],
      text: 'Buổi chia sẻ "Tài chính cá nhân cho người mới đi làm" cuối tuần qua đông hơn tụi mình nghĩ. Slide mình để ở phần bình luận nhé!',
      comments: [C('linh', 'Slide ở đâu vậy chị?', 4200, 1), C('phuong', '@Đỗ Khánh Linh chị ghim ở bình luận đầu nha.', 4100, 0)] })
  ];
  const OLDER = [
    P({ id: 7, who: 'nexa', mins: 6000, media: [{ s: 'city' }], likes: 88, likedBy: ['huy'], text: 'Nexa Pay vừa mở văn phòng thứ hai ở Quận 3 🎉 Tháng 10 này bên mình tuyển 6 vị trí kỹ thuật, xem chi tiết ở trang công ty nhé. #NexaPay', comments: [C('huy', 'Văn phòng mới view đẹp ghê', 5800, 2)] }),
    P({ id: 8, who: 'thinh', mins: 7200, likes: 12, likedBy: ['nam'], text: 'Có ai đang dùng Flutter 3.24 bị lỗi build iOS với Xcode 16 không? Mình mất nguyên buổi chiều mà chưa ra 😵', comments: [C('nam', 'Xoá Pods rồi pod install lại thử xem Thịnh.', 7100, 3)] }),
    P({ id: 9, who: 'lumen', mins: 8600, media: [{ s: 'whiteboard' }], ar: '1 / 1', likes: 64, likedBy: ['ha'], text: 'Workshop "Thiết kế hệ thống cho người mới" tuần trước. Cảm ơn 40 bạn sinh viên đã tới cùng tụi mình! #LumenStudio' })
  ];
  const OLDEST = [
    P({ id: 10, who: 'ha', mins: 12000, likes: 91, likedBy: ['linh', 'huy'], title: 'Một năm sau khi ra trường', text: 'Một năm trước mình còn gửi CV khắp nơi mà không ai trả lời. Điều thay đổi lớn nhất là mình bắt đầu làm dự án thật và chia sẻ quá trình lên đây. Cảm ơn mọi người đã góp ý suốt thời gian qua.' })
  ];
  const INCOMING = [
    P({ id: 11, who: 'nam', mins: 0, media: [{ s: 'coffee' }], text: 'Cà phê sáng trước buổi phỏng vấn QA Lead đầu tiên. Chúc mình may mắn nha mọi người 🍀' }),
    P({ id: 12, who: 'technova', mins: 1, text: 'TechNova Tech Talk #12 diễn ra tối thứ Năm này: "Đo hiệu năng frontend bằng dữ liệu thật". Đăng ký miễn phí ở trang công ty nhé! #TechTalk' })
  ];
  const countComments = (p) => p.comments.reduce((n, c) => n + 1 + c.replies.length, 0);
  [...POSTS, ...OLDER, ...OLDEST, ...INCOMING].forEach((p) => { p.commentCount = countComments(p); });

  /* Tin 24 giờ [CẦN BACKEND: bảng Stories + GET /Stories/Feed, POST /Stories, POST /Stories/{id}/View] */
  const STORIES = [
    { who: 'technova', seen: false, items: [{ s: 'office', cap: 'Sáng thứ Hai ở văn phòng Quận 1', mins: 180 }, { s: 'team', cap: 'Đang tuyển 2 Frontend Developer', mins: 120, link: { label: 'Xem việc làm', href: 'jobs.html?job=1' } }] },
    { who: 'ha', seen: false, items: [{ s: 'desk', cap: 'Buổi review thiết kế đầu tiên ☕', mins: 240 }] },
    { who: 'huy', seen: false, items: [{ s: 'code', cap: 'Refactor xong module thanh toán 🎉', mins: 300 }, { s: 'city', cap: '', mins: 280 }] },
    { who: 'nexa', seen: false, items: [{ s: 'city', cap: 'Văn phòng mới ở Quận 3', mins: 500, link: { label: '6 việc đang tuyển', href: 'jobs.html' } }] },
    { who: 'nam', seen: false, items: [{ s: 'coffee', cap: 'Ngày thứ 3 viết test tự động', mins: 600 }] },
    { who: 'thinh', seen: false, items: [{ s: 'code', cap: 'Build iOS xanh rồi 🥹', mins: 700 }] },
    { who: 'linh', seen: true, items: [{ s: 'whiteboard', cap: 'Ôn phỏng vấn cùng nhóm', mins: 800 }] },
    { who: 'phuong', seen: true, items: [{ s: 'meetup', cap: 'Sắp bắt đầu rồi!', mins: 900 }] }
  ];

  const nextTue = (() => { const d = new Date(); d.setDate(d.getDate() + (((2 - d.getDay() + 7) % 7) || 7)); d.setHours(14, 0, 0, 0); return d; })();
  const state = {
    posts: POSTS.slice(),
    sentReq: new Set(),
    following: new Set(),
    myStory: null,
    todo: {
      interviews: [{ id: 301, company: 'TechNova', job: 'Frontend Developer (React)', when: nextTue, mode: 'Trực tuyến qua Aris', status: 'pending' }],
      requests: [{ id: 401, who: 'tuan', status: 'pending' }, { id: 402, who: 'vy', status: 'pending' }]
    },
    suggest: ['quang', 'an', 'trang'],
    loading: false,
    ended: false
  };
  const byId = (id) => state.posts.find((p) => p.id === id);

  /* ---------------------------------------------------------------------------
     HIỂN THỊ
     --------------------------------------------------------------------------- */
  function face(key, size, ring) {
    const p = PEOPLE[key];
    const inner = p.org
      ? `<span class="a-logo" data-tone="${toneOf(p.name)}" style="--_s:${size}px;border-radius:${Math.round(size * .26)}px" aria-hidden="true">${orgInitials(p.name)}</span>`
      : `<span class="a-avatar" data-tone="${toneOf(p.name)}" style="--_s:${size}px" aria-hidden="true">${initials(p.name)}</span>`;
    return ring ? `<span class="sring${ring === 'seen' ? ' is-seen' : ''}" data-sw="${key}">${inner}</span>` : inner;
  }
  const ringFor = (k) => { if (k === 'me') return state.myStory ? 'new' : null; const s = STORIES.find((x) => x.who === k); return s ? (s.seen ? 'seen' : 'new') : null; };
  const hasStory = (k) => !!ringFor(k);

  function timeAgo(mins) {
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút`;
    if (mins < 1440) return `${Math.floor(mins / 60)} giờ`;
    const d = Math.floor(mins / 1440);
    return d === 1 ? 'Hôm qua' : `${d} ngày`;
  }
  function fullDate(mins) {
    const d = new Date(Date.now() - mins * 60000);
    return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()} lúc ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const NAMES = Object.values(PEOPLE).map((p) => p.name).sort((a, b) => b.length - a.length);
  const MENTION_RE = new RegExp('@(' + NAMES.join('|') + ')', 'g');
  function richText(t) {
    return esc(t)
      .replace(MENTION_RE, (m, name) => `<a class="mention" href="#" data-hover="${keyOf(name)}">@${name}</a>`)
      .replace(/(^|\s)#([\p{L}\d_]+)/gu, '$1<a class="hashtag" href="#tag-$2">#$2</a>')
      .replace(/\n/g, '<br>');
  }

  function likesHtml(p) {
    if (p.likes <= 0) return '<span class="post__likes-empty">Hãy là người đầu tiên thích bài này</span>';
    const others = p.likedBy.filter((k) => k !== 'me');
    const faces = (p.liked ? ['me', ...others] : others).slice(0, 2);
    const stack = faces.length ? `<span class="avstack">${faces.map((k) => face(k, 20)).join('')}</span>` : '';
    const first = p.liked ? '<b>bạn</b>' : others[0] ? `<a href="#" data-hover="${others[0]}">${esc(PEOPLE[others[0]].name)}</a>` : null;
    const rest = first ? p.likes - 1 : p.likes;
    if (!first) return `${stack}<span><b><span class="a-num" data-lcount>${rest}</span> lượt thích</b></span>`;
    return `${stack}<span>${rest > 0 ? `Được thích bởi ${first} và <b><span class="a-num" data-lcount>${rest}</span> người khác</b>` : `${p.liked ? '<b>Bạn</b>' : first} đã thích`}</span>`;
  }

  function carHtml(p, inDialog) {
    const n = p.media.length;
    return `<div class="car" data-car style="--ar:${p.ar}" aria-roledescription="carousel" aria-label="Ảnh trong bài của ${esc(PEOPLE[p.who].name)}">
      <div class="car__track">
        ${p.media.map((m, i) => `<figure class="car__slide" aria-roledescription="slide" aria-label="${i + 1} / ${n}">${mediaEl(m, `Ảnh ${i + 1} trong bài của ${PEOPLE[p.who].name}`)}</figure>`).join('')}
      </div>
      ${n > 1 ? `<button class="car__btn car__btn--prev" type="button" data-car-step="-1" aria-label="Ảnh trước" hidden><i data-lucide="chevron-left"></i></button>
        <button class="car__btn car__btn--next" type="button" data-car-step="1" aria-label="Ảnh sau"><i data-lucide="chevron-right"></i></button>
        <span class="car__count a-num" aria-hidden="true">1/${n}</span>${inDialog ? dotsHtml(p) : ''}` : ''}
    </div>`;
  }
  const dotsHtml = (p) => `<div class="car__dots" aria-hidden="true">${p.media.map((_, i) => `<span class="car__dot${i === 0 ? ' is-on' : ''}"></span>`).join('')}</div>`;

  function pollHtml(p) {
    const poll = p.poll;
    const total = poll.opts.reduce((s, o) => s + o[1], 0);
    const voted = poll.voted != null;
    return `<div class="poll${voted ? ' is-voted' : ''}" role="group" aria-label="Bình chọn: ${esc(poll.q)}">
      <div class="poll__q">${esc(poll.q)}</div>
      ${poll.opts.map(([label, n], i) => {
        const pct = total ? Math.round(n * 100 / total) : 0;
        return `<button class="poll__opt${poll.voted === i ? ' is-mine' : ''}" type="button" data-vote="${i}" ${voted ? 'aria-disabled="true"' : ''} aria-pressed="${poll.voted === i}" style="--pct:${pct}%">
          ${voted ? '<span class="poll__bar"></span>' : ''}<span class="poll__label">${esc(label)}${poll.voted === i ? '<i data-lucide="check-circle-2"></i>' : ''}</span>${voted ? `<span class="poll__pct" data-pct="${pct}">${pct}%</span>` : ''}</button>`;
      }).join('')}
      <div class="poll__meta"><span><span class="a-num" data-votes>${total}</span> phiếu</span><span>·</span><span>Còn ${poll.days} ngày</span>${voted ? '<span>·</span><button type="button" data-unvote>Rút lại phiếu</button>' : ''}</div>
    </div>`;
  }

  function bodyHtml(p, isText) {
    const hasBody = p.text || p.title;
    const long = isText ? p.text.length > 300 : p.text.length > 120;
    return `<div class="post__body"${hasBody ? '' : ' hidden'}>
      ${p.title ? `<h2 class="post__title">${esc(p.title)}</h2>` : ''}
      <div class="post__text${long ? ' is-clamped' : ''}" data-text>${isText ? '' : `<a class="post__author" href="#" data-hover="${p.who}">${esc(PEOPLE[p.who].name)}</a>`}${richText(p.text)}</div>
      ${long ? '<button class="post__more" type="button" data-more>Xem thêm</button>' : ''}
    </div>`;
  }
  const pcHtml = (c) => `<div class="pc" id="pc-${c.id}"><span><a href="#" data-hover="${c.who}">${esc(PEOPLE[c.who].name)}</a> ${richText(c.text)}</span><button class="pc__like" type="button" data-clike="${c.id}" aria-pressed="${c.liked}" aria-label="Thích bình luận"><i data-lucide="heart"></i></button></div>`;

  function postHtml(p) {
    const a = PEOPLE[p.who];
    const isText = !p.media;
    let follow = '';
    if (a.org) follow = `<button class="link-btn post__follow${state.following.has(p.who) ? ' is-sent' : ''}" type="button" data-follow="${p.who}">${state.following.has(p.who) ? 'Đang theo dõi' : 'Theo dõi'}</button>`;
    else if (p.who !== 'me' && !a.friend) follow = `<button class="link-btn post__follow${state.sentReq.has(p.who) ? ' is-sent' : ''}" type="button" data-add="${p.who}">${state.sentReq.has(p.who) ? 'Đã gửi' : 'Kết bạn'}</button>`;
    return `<article class="post${isText ? ' post--text' : ''}" id="post-${p.id}" data-pid="${p.id}" tabindex="-1" aria-labelledby="post-${p.id}-by">
      <header class="post__head">
        <button class="post__face" type="button" data-hover="${p.who}" data-story-of="${p.who}" aria-label="${hasStory(p.who) ? 'Xem tin của ' : ''}${esc(a.name)}">${face(p.who, 36, ringFor(p.who))}</button>
        <div class="post__who">
          <div class="post__name"><a href="#" id="post-${p.id}-by" data-hover="${p.who}">${esc(a.name)}</a><span class="post__time"><time title="${fullDate(p.mins)}">${timeAgo(p.mins)}</time>${p.edited ? ' · đã sửa' : ''}${p.audience === 'friends' ? ' · <span title="Chỉ bạn bè">Bạn bè</span>' : ''}</span></div>
          <div class="post__sub">${esc(a.role)}</div>
        </div>
        ${follow}
        <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-menu aria-label="Tuỳ chọn bài viết" aria-haspopup="menu"><i data-lucide="more-horizontal"></i></button>
      </header>
      ${isText ? bodyHtml(p, true) : ''}
      ${p.poll ? pollHtml(p) : ''}
      ${p.media ? carHtml(p) : ''}
      ${p.job ? `<a class="post-job" href="jobs.html?job=${p.job.id}">${face(p.who, 40)}<div class="post-job__text"><div class="post-job__title">${esc(p.job.title)}</div><div class="post-job__sub">${esc(p.job.salary)} · ${esc(p.job.city)} · ${esc(p.job.mode)}</div></div><span class="a-btn a-btn--secondary a-btn--sm">Ứng tuyển</span></a>` : ''}
      <div class="post__actions">
        <button class="act act--like" type="button" data-like aria-pressed="${p.liked}" aria-label="${p.liked ? 'Bỏ thích' : 'Thích'}"><i data-lucide="heart"></i></button>
        <button class="act" type="button" data-comments aria-label="Bình luận"><i data-lucide="message-circle"></i></button>
        <button class="act" type="button" data-share aria-label="Gửi cho bạn bè"><i data-lucide="send"></i></button>
        ${p.media && p.media.length > 1 ? dotsHtml(p) : ''}
        <button class="act act--save" type="button" data-save aria-pressed="${p.saved}" aria-label="${p.saved ? 'Bỏ lưu' : 'Lưu bài viết'}"><i data-lucide="bookmark"></i></button>
      </div>
      <div class="post__likes" data-likes>${likesHtml(p)}</div>
      ${!isText ? bodyHtml(p, false) : ''}
      <button class="post__viewc" type="button" data-comments ${p.commentCount > 2 ? '' : 'hidden'}>Xem tất cả <span class="a-num" data-ccount>${p.commentCount}</span> bình luận</button>
      <div class="post__pc" data-pc>${p.comments.slice(-2).map(pcHtml).join('')}</div>
      <form class="post__quick" data-quick autocomplete="off">
        <input class="post__qinput" type="text" placeholder="Thêm bình luận…" aria-label="Thêm bình luận" maxlength="1000">
        <button class="post__qsend" type="submit" hidden>Đăng</button>
      </form>
    </article>`;
  }
  function makePost(p) { const t = document.createElement('div'); t.innerHTML = postHtml(p); return t.firstElementChild; }
  const hosts = (p) => $$(`[data-pid="${p.id}"]`);
  const list = $('#feedList');

  function moduleAfter(i) {
    if (i === 0) return '<section class="feed-module" data-module="todo" aria-label="Việc cần làm"></section>';
    if (i === 2) return '<section class="feed-module" data-module="suggest" aria-label="Gợi ý kết bạn"></section>';
    return '';
  }
  function renderFeed() {
    list.innerHTML = state.posts.map((p, i) => postHtml(p) + moduleAfter(i)).join('');
    wireAll(list);
    renderIcons();
  }
  function wireAll(root) { $$('.car', root).forEach(wireCarousel); if (root.classList && root.classList.contains('car')) wireCarousel(root); }

  /* Nháy viền 1 lần cho phần tử lớn (bài viết mới chèn, bài vừa hoàn tác) */
  function ringFlash(el) {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--brand-line').trim();
    M.animate(el, [{ boxShadow: `0 0 0 3px ${c}` }, { boxShadow: `0 0 0 3px ${c}`, offset: .4 }, { boxShadow: '0 0 0 3px transparent' }], { duration: 1400, easing: 'ease-out' });
  }

  /* ---------------------------------------------------------------------------
     CAROUSEL: vuốt / nút ‹ › / chấm; nhấn đúp để thích; nhấn 1 lần (desktop) xem ảnh lớn
     --------------------------------------------------------------------------- */
  function wireCarousel(car) {
    if (car._wired) return;
    car._wired = true;
    const host = car.closest('[data-pid]');
    const p = byId(+host.dataset.pid);
    const track = $('.car__track', car);
    const n = $$('.car__slide', car).length;
    const count = $('.car__count', car);
    let idx = 0;
    let idleT;
    const idle = () => { if (!count) return; count.classList.remove('is-idle'); clearTimeout(idleT); idleT = setTimeout(() => count.classList.add('is-idle'), 1800); };
    const sync = () => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== idx) {
        idx = i;
        car.dataset.idx = i;
        const dots = car.closest('.pd') ? $$('.car__dot', car) : $$('.post__actions .car__dot', host);
        dots.forEach((d, k) => d.classList.toggle('is-on', k === i));
        if (count) count.textContent = `${i + 1}/${n}`;
      }
      const pr = $('.car__btn--prev', car);
      const nx = $('.car__btn--next', car);
      if (pr) pr.hidden = i === 0;
      if (nx) nx.hidden = i === n - 1;
      idle();
    };
    track.addEventListener('scroll', sync, { passive: true });
    car.step = (dir) => {
      const j = idx + dir;
      if (j < 0 || j >= n) { M.shake(track); return; }
      track.scrollTo({ left: j * track.clientWidth, behavior: M.reduced() ? 'auto' : 'smooth' });
    };
    car.goTo = (j) => { track.scrollTo({ left: j * track.clientWidth, behavior: 'auto' }); sync(); };
    idle();

    let down = null;
    let lastUp = 0;
    let lx = 0;
    let ly = 0;
    let single;
    track.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    track.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down = null; return; }
      down = null;
      if (e.timeStamp - lastUp < 320 && Math.hypot(e.clientX - lx, e.clientY - ly) < 40) {
        clearTimeout(single);
        lastUp = 0;
        doubleLike(p, car, e);
        return;
      }
      lastUp = e.timeStamp;
      lx = e.clientX;
      ly = e.clientY;
      if (car.closest('.pd') || isMobile()) return; /* mobile: chạm 1 lần không làm gì (như Instagram) */
      single = setTimeout(() => {
        const imgs = $$('.car__slide img', car);
        openLightbox(p.media.map((m, k) => ({ src: mediaSrc(m), alt: imgs[k] ? imgs[k].alt : '', thumb: k === idx ? imgs[k] : null })), idx);
      }, 320);
    });
  }

  /* ---------------------------------------------------------------------------
     THÍCH · LƯU · NHẤN ĐÚP
     --------------------------------------------------------------------------- */
  function doubleLike(p, car, e) {
    const r = car.getBoundingClientRect();
    const h = document.createElement('span');
    h.className = 'bigheart';
    h.innerHTML = HEART;
    h.style.left = (e.clientX - r.left) + 'px';
    h.style.top = (e.clientY - r.top) + 'px';
    car.append(h);
    const rot = (Math.random() * 24 - 12).toFixed(1);
    const a = h.animate([
      { transform: `scale(0) rotate(${rot}deg)`, opacity: 0 },
      { transform: `scale(1.18) rotate(${rot}deg)`, opacity: 1, offset: .22 },
      { transform: `scale(.94) rotate(${rot}deg)`, opacity: 1, offset: .36 },
      { transform: `scale(1) rotate(${rot}deg)`, opacity: 1, offset: .7 },
      { transform: `translateY(-48px) scale(.9) rotate(${rot}deg)`, opacity: 0 }
    ], { duration: M.reduced() ? 1 : 1000, easing: 'ease-out' });
    a.finished.then(() => h.remove()).catch(() => h.remove());
    if (p.liked) hosts(p).forEach((x) => { const b = $('[data-like] svg', x); if (b) M.pulse(b, 1.25); });
    else setLike(p, true);
  }
  /* Lạc quan: đổi giao diện ngay → gọi POST /Dashboard/ToggleLike → lỗi thì trả lại + rung + toast */
  function setLike(p, on) {
    if (p.liked === on) return;
    p.liked = on;
    p.likes += on ? 1 : -1;
    syncLike(p, on);
    api(400, window.__failLike).catch(() => {
      p.liked = !on;
      p.likes += on ? -1 : 1;
      syncLike(p, !on, true);
      hosts(p).forEach((x) => M.shake($('[data-like]', x)));
      M.toast('Chưa thích được bài viết vì mất kết nối. Thử lại nhé.', { tone: 'danger' });
    });
  }
  function syncLike(p, on, quiet) {
    hosts(p).forEach((h) => {
      const b = $('[data-like]', h);
      if (!b) return;
      b.setAttribute('aria-pressed', String(p.liked));
      b.setAttribute('aria-label', p.liked ? 'Bỏ thích' : 'Thích');
      if (!quiet) {
        M.animate($('svg', b), on
          ? [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }]
          : [{ transform: 'scale(.8)' }, { transform: 'scale(1)' }], { duration: on ? 440 : 220, easing: on ? M.SPRING : M.EASE_OUT });
      }
      updateLikes(h, p);
    });
  }
  function updateLikes(h, p) {
    const box = $('[data-likes]', h);
    if (!box) return;
    const old = $('[data-lcount]', box);
    const prev = old ? (old.dataset.value || old.textContent) : null;
    box.innerHTML = likesHtml(p);
    const neu = $('[data-lcount]', box);
    if (neu && prev !== null && prev !== neu.textContent) { const next = neu.textContent; neu.textContent = prev; neu.dataset.value = prev; M.rollNumber(neu, next); }
  }
  /* [CẦN BACKEND] POST /Posts/{id}/Save — bảng SavedPosts */
  function toggleSave(p) {
    p.saved = !p.saved;
    hosts(p).forEach((h) => {
      const b = $('[data-save]', h);
      if (!b) return;
      b.setAttribute('aria-pressed', String(p.saved));
      b.setAttribute('aria-label', p.saved ? 'Bỏ lưu' : 'Lưu bài viết');
      M.animate($('svg', b), [{ transform: 'scale(.7)' }, { transform: 'scale(1)' }], { duration: 360, easing: M.SPRING });
    });
    M.toast(p.saved ? 'Đã lưu vào mục Đã lưu.' : 'Đã bỏ lưu bài viết.', p.saved ? { action: { label: 'Xem', onClick() {} } } : {});
  }

  /* ---------------------------------------------------------------------------
     CHÚ THÍCH "Xem thêm" · BÌNH LUẬN NHANH
     --------------------------------------------------------------------------- */
  function expandText(btn) {
    const t = $('[data-text]', btn.parentElement);
    const h0 = t.offsetHeight;
    t.classList.remove('is-clamped');
    const h1 = t.offsetHeight;
    btn.remove();
    M.animate(t, [{ height: h0 + 'px', overflow: 'hidden' }, { height: h1 + 'px', overflow: 'hidden' }], { duration: 300, easing: M.EASE_OUT });
  }
  list.addEventListener('input', (e) => {
    const inp = e.target.closest('.post__qinput');
    if (!inp) return;
    const b = $('.post__qsend', inp.form);
    const has = !!inp.value.trim();
    if (b.hidden === has) {
      b.hidden = !has;
      if (has) M.animate(b, [{ opacity: 0, transform: 'translateX(6px)' }, { opacity: 1, transform: 'none' }], { duration: 160, easing: M.EASE_OUT });
    }
  });
  /* Bộ gõ tiếng Việt: Enter khi đang ghép chữ (isComposing / keyCode 229) KHÔNG được gửi */
  list.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.closest('.post__qinput') && (e.isComposing || e.keyCode === 229)) e.preventDefault(); });
  list.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-quick]');
    if (!f) return;
    e.preventDefault();
    const inp = $('.post__qinput', f);
    const text = inp.value.trim();
    if (!text) return;
    addComment(byId(+f.closest('[data-pid]').dataset.pid), text, null);
    inp.value = '';
    $('.post__qsend', f).hidden = true;
  });

  /* POST /Dashboard/AddComment. Trả lời bình luận (parent) [CẦN BACKEND: Comment.ParentCommentId] */
  function addComment(p, text, parent) {
    const c = { id: nid++, who: 'me', text, mins: 0, likes: 0, liked: false, replies: [] };
    (parent ? parent.replies : p.comments).push(c);
    p.commentCount++;
    syncCounts(p);
    patchPreviews(p, c);
    if (pdPost === p && !pd.hidden) insertDialogComment(p, c, parent);
    return c;
  }
  function syncCounts(p) {
    hosts(p).forEach((h) => {
      $$('[data-ccount]', h).forEach((el) => M.rollNumber(el, p.commentCount));
      const vc = $('.post__viewc', h);
      if (vc) vc.hidden = p.commentCount <= 2;
    });
  }
  function patchPreviews(p, fresh) {
    hosts(p).forEach((h) => {
      const pc = $('[data-pc]', h);
      if (!pc) return;
      const want = p.comments.slice(-2);
      M.flip(pc, () => {
        const keep = new Set(want.map((c) => 'pc-' + c.id));
        $$('.pc', pc).forEach((el) => { if (!keep.has(el.id)) el.remove(); });
        want.forEach((c) => { if (!pc.querySelector('#pc-' + c.id)) pc.insertAdjacentHTML('beforeend', pcHtml(c)); });
      }, { selector: '.pc' });
      renderIcons();
      const el = fresh && pc.querySelector('#pc-' + fresh.id);
      if (el) M.highlight(el);
    });
  }

  /* ---------------------------------------------------------------------------
     BÌNH CHỌN [CẦN BACKEND: PostPolls, PollOptions, PollVotes; POST /Posts/{id}/Vote]
     --------------------------------------------------------------------------- */
  function renderPoll(p, animate) {
    hosts(p).forEach((h) => {
      const box = $('.poll', h);
      if (!box) return;
      box.outerHTML = pollHtml(p);
      const nb = $('.poll', h);
      if (!animate) return;
      $$('.poll__opt', nb).forEach((o, k) => {
        const bar = $('.poll__bar', o);
        const pct = o.style.getPropertyValue('--pct');
        if (bar) { bar.style.width = pct; M.animate(bar, [{ width: '0%' }, { width: pct }], { duration: 640, delay: k * 50, easing: M.EASE_OUT }); }
        const pe = $('.poll__pct', o);
        if (pe) { const v = pe.dataset.pct + '%'; pe.textContent = '0%'; pe.dataset.value = '0%'; setTimeout(() => M.rollNumber(pe, v), k * 50); }
      });
    });
    renderIcons();
  }
  function vote(p, i) {
    if (p.poll.voted != null) return;
    p.poll.voted = i;
    p.poll.opts[i][1]++;
    renderPoll(p, true);
  }
  function unvote(p) {
    p.poll.opts[p.poll.voted][1]--;
    p.poll.voted = null;
    renderPoll(p, false);
  }

  /* ---------------------------------------------------------------------------
     MENU "…" · SỬA · XOÁ (Hoàn tác) · ẨN
     --------------------------------------------------------------------------- */
  function openMenu(btn, p) {
    const pop = $('#postMenu');
    const a = PEOPLE[p.who];
    const items = p.who === 'me'
      ? [['pencil', 'Sửa bài viết', 'edit'], ['link', 'Sao chép liên kết', 'copy'], ['sep'], ['trash-2', 'Xoá bài viết', 'delete', 1]]
      : [[p.saved ? 'bookmark-minus' : 'bookmark', p.saved ? 'Bỏ lưu' : 'Lưu bài viết', 'save'], ['send', 'Gửi cho bạn bè', 'share'], ['link', 'Sao chép liên kết', 'copy'],
        ...(a.org ? [['briefcase', `Việc làm của ${a.name}`, 'jobs']] : [['message-circle', `Nhắn tin cho ${shortName(p.who)}`, 'message']]),
        ['sep'], ['eye-off', 'Ẩn bài viết này', 'hide'], ['flag', 'Báo cáo bài viết', 'report', 1]];
    pop.innerHTML = items.map((it) => (it[0] === 'sep' ? '<div class="a-menu__sep"></div>'
      : `<button class="a-menu__item${it[3] ? ' a-menu__item--danger' : ''}" type="button" role="menuitem" data-mact="${it[2]}"><i data-lucide="${it[0]}"></i>${esc(it[1])}</button>`)).join('');
    renderIcons();
    pop.onclick = (e) => { const b = e.target.closest('[data-mact]'); if (!b) return; closePopover(); menuAction(b.dataset.mact, p, btn); };
    openPopover(pop, btn, 'bottom-end');
  }
  async function menuAction(act, p, btn) {
    if (['edit', 'delete', 'hide'].includes(act) && !pd.hidden) await closePost();
    if (act === 'edit') startEdit(p);
    else if (act === 'copy') copyLink(p);
    else if (act === 'delete') deletePost(p);
    else if (act === 'save') toggleSave(p);
    else if (act === 'share') openShare(p, btn);
    else if (act === 'message') location.href = 'chat.html?userId=' + PEOPLE[p.who].id;
    else if (act === 'jobs') location.href = 'jobs.html';
    else if (act === 'hide') hidePost(p);
    else if (act === 'report') M.toast('Cảm ơn bạn. Chúng tôi sẽ xem xét bài viết này trong 24 giờ.', { tone: 'success' }); /* [CẦN BACKEND] POST /Posts/{id}/Report */
  }
  function copyLink(p, btn) {
    const url = `${location.origin}${location.pathname}?post=${p.id}`;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).catch(() => {});
    if (btn) { const ic = $('span:first-child', btn); const old = ic.innerHTML; ic.innerHTML = '<i data-lucide="check"></i>'; renderIcons(); M.pulse(ic); setTimeout(() => { ic.innerHTML = old; }, 1600); }
    M.toast('Đã sao chép liên kết.', { tone: 'success' });
  }
  /* Xoá: gỡ khỏi giao diện ngay, chỉ gọi DELETE /Dashboard/DeletePost/{id} khi hết 6 giây mà không bấm Hoàn tác */
  async function deletePost(p) {
    const el = $('#post-' + p.id);
    const idx = state.posts.indexOf(p);
    const next = el.nextElementSibling;
    await M.removeFrom(list, el);
    state.posts.splice(idx, 1);
    let undone = false;
    M.toast('Đã xoá bài viết.', {
      duration: 6000,
      action: {
        label: 'Hoàn tác',
        onClick: () => {
          undone = true;
          state.posts.splice(idx, 0, p);
          const fresh = makePost(p);
          M.flip(list, () => { if (next && next.isConnected) list.insertBefore(fresh, next); else list.append(fresh); });
          wireAll(fresh);
          renderIcons();
          ringFlash(fresh);
        }
      }
    });
    setTimeout(() => { if (!undone) { /* fetch('/Dashboard/DeletePost/' + p.id, { method: 'DELETE' }) */ } }, 6300);
  }
  /* [CẦN BACKEND] POST /Posts/{id}/Hide */
  function hidePost(p) {
    const el = $('#post-' + p.id);
    const ph = document.createElement('div');
    ph.className = 'post-hidden';
    ph.innerHTML = '<span>Đã ẩn bài viết. Bạn sẽ thấy ít bài như thế này hơn.</span><button class="a-btn a-btn--ghost a-btn--sm" type="button">Hoàn tác</button>';
    const h0 = el.offsetHeight;
    el.replaceWith(ph);
    const h1 = ph.offsetHeight;
    M.animate(ph, [{ height: h0 + 'px', opacity: .2 }, { height: h1 + 'px', opacity: 1 }], { duration: 340, easing: M.EASE_OUT });
    $('button', ph).addEventListener('click', () => {
      ph.replaceWith(el);
      M.animate(el, [{ height: h1 + 'px', overflow: 'hidden' }, { height: h0 + 'px', overflow: 'hidden' }], { duration: 340, easing: M.EASE_OUT });
    });
  }
  /* Sửa tại chỗ — POST /Dashboard/EditPost (id, content, title) */
  function startEdit(p) {
    const el = $('#post-' + p.id);
    if (!el || $('.post__edit', el)) return;
    const body = $('.post__body', el);
    const ed = document.createElement('div');
    ed.className = 'post__edit';
    ed.innerHTML = `${p.title != null ? `<input class="a-input" data-etitle value="${esc(p.title)}" placeholder="Tiêu đề (không bắt buộc)" aria-label="Tiêu đề">` : ''}
      <textarea class="a-textarea" data-etext rows="2" aria-label="Nội dung bài viết">${esc(p.text)}</textarea>
      <div class="post__edit-foot"><span class="a-help">Esc để huỷ · Ctrl + Enter để lưu</span>
        <button class="a-btn a-btn--ghost a-btn--sm" type="button" data-ecancel>Huỷ</button>
        <button class="a-btn a-btn--primary a-btn--sm" type="button" data-esave>Lưu</button></div>`;
    body.hidden = true;
    body.after(ed);
    const ta = $('textarea', ed);
    wireMentions(ta);
    autosize(ta);
    ta.addEventListener('input', () => { autosize(ta); ta.removeAttribute('aria-invalid'); });
    M.animate(ed, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    const cancel = () => { ed.remove(); body.hidden = !(p.text || p.title); el.focus({ preventScroll: true }); };
    const save = async () => {
      const text = ta.value.trim();
      if (!text && !p.media) { ta.setAttribute('aria-invalid', 'true'); M.shake(ta); return; }
      const btn = $('[data-esave]', ed);
      M.morphButton(btn, 'loading');
      await api(700);
      M.morphButton(btn, 'success', { hold: true });
      await sleep(420);
      p.text = text;
      if (p.title != null) p.title = $('[data-etitle]', ed).value.trim() || null;
      p.edited = true;
      const fresh = makePost(p);
      el.replaceWith(fresh);
      wireAll(fresh);
      renderIcons();
      M.highlight($('.post__body', fresh));
      M.toast('Đã lưu thay đổi.', { tone: 'success' });
    };
    ed.addEventListener('click', (e) => { if (e.target.closest('[data-ecancel]')) cancel(); if (e.target.closest('[data-esave]')) save(); });
    ed.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
    });
  }

  /* ---------------------------------------------------------------------------
     THẺ HỒ SƠ KHI HOVER (chỉ chuột/bút; chạm thì mở hồ sơ)
     --------------------------------------------------------------------------- */
  const hc = $('#hovercard');
  let hcT;
  let hcHideT;
  let hcFor = null;
  let hcTok = 0;
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    if (e.target.closest('#hovercard')) { clearTimeout(hcHideT); return; }
    const t = e.target.closest('[data-hover]');
    if (!t) return;
    clearTimeout(hcHideT);
    if (hcFor === t) return;
    clearTimeout(hcT);
    hcT = setTimeout(() => showHc(t), 480);
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target.closest('[data-hover], #hovercard');
    if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return;
    clearTimeout(hcT);
    hcHideT = setTimeout(hideHc, 240);
  });
  function showHc(anchor) {
    const key = anchor.dataset.hover;
    const a = PEOPLE[key];
    if (!a || key === 'me' || !anchor.isConnected) return;
    hcFor = anchor;
    hcTok++;
    const mutual = FRIENDS().filter((k) => k !== key).slice(0, 2);
    const sent = state.sentReq.has(key);
    hc.innerHTML = `
      <div class="hc__top">${face(key, 56, ringFor(key))}<div style="min-width:0"><div class="hc__name">${esc(a.name)}</div><div class="hc__role">${esc(a.role)}</div></div></div>
      ${!a.org && a.mutual ? `<div class="hc__mutual"><span class="avstack">${mutual.map((k) => face(k, 20)).join('')}</span><span>${a.mutual} bạn chung, gồm ${esc(PEOPLE[mutual[0]].name)}</span></div>` : ''}
      <div class="hc__actions">
        ${a.org
          ? `<a class="a-btn a-btn--primary a-btn--sm" href="jobs.html"><i data-lucide="briefcase"></i>Xem việc làm</a><button class="a-btn a-btn--secondary a-btn--sm" type="button" data-follow="${key}">${state.following.has(key) ? 'Đang theo dõi' : 'Theo dõi'}</button>`
          : a.friend
            ? `<a class="a-btn a-btn--primary a-btn--sm" href="chat.html?userId=${a.id}"><i data-lucide="message-circle"></i>Nhắn tin</a><a class="a-btn a-btn--secondary a-btn--sm" href="#profile">Xem hồ sơ</a>`
            : `<button class="a-btn ${sent ? 'a-btn--secondary' : 'a-btn--primary'} a-btn--sm${sent ? ' is-sent' : ''}" type="button" data-add="${key}">${sent ? 'Đã gửi lời mời' : 'Kết bạn'}</button><a class="a-btn a-btn--secondary a-btn--sm" href="chat.html?userId=${a.id}">Nhắn tin</a>`}
      </div>`;
    renderIcons();
    hc.getAnimations().forEach((x) => x.cancel());
    hc.hidden = false;
    const r = anchor.getBoundingClientRect();
    const h = hc.offsetHeight;
    let top = r.bottom + 8;
    if (top + h > innerHeight - 8) top = r.top - h - 8;
    hc.style.left = Math.max(8, Math.min(r.left - 12, innerWidth - hc.offsetWidth - 8)) + 'px';
    hc.style.top = top + 'px';
    M.pop(hc, anchor);
  }
  function hideHc() {
    if (hc.hidden) return;
    hcFor = null;
    const tok = ++hcTok;
    M.animate(hc, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }).finished.then(() => {
      if (tok !== hcTok) return;
      hc.hidden = true;
      hc.getAnimations().forEach((x) => x.cancel());
    });
  }

  /* Kết bạn — POST /Friends/SendRequest | CancelRequest; nút ở mọi nơi (bài viết, thẻ hover, gợi ý) đồng bộ */
  async function toggleAdd(key, btn) {
    const sent = state.sentReq.has(key);
    const isBtn = btn.classList.contains('a-btn');
    if (isBtn) M.morphButton(btn, 'loading');
    await api(450);
    if (isBtn) M.morphButton(btn, 'idle');
    if (sent) state.sentReq.delete(key); else state.sentReq.add(key);
    syncAdd(key);
    if (!isBtn) M.pulse(btn, 1.08);
    if (!sent) M.toast(`Đã gửi lời mời kết bạn tới ${PEOPLE[key].name}.`, { action: { label: 'Hoàn tác', onClick: () => { state.sentReq.delete(key); syncAdd(key); } } });
  }
  function syncAdd(key) {
    const sent = state.sentReq.has(key);
    $$(`[data-add="${key}"]`).forEach((b) => {
      const txt = sent ? (b.closest('.hovercard') ? 'Đã gửi lời mời' : 'Đã gửi') : 'Kết bạn';
      ($('.a-btn__label', b) || b).textContent = txt;
      b.classList.toggle('is-sent', sent);
      if (b.classList.contains('a-btn')) { b.classList.toggle('a-btn--primary', !sent); b.classList.toggle('a-btn--secondary', sent); }
    });
  }
  /* [CẦN BACKEND] POST /Companies/{id}/Follow */
  function toggleFollow(key, btn) {
    const on = !state.following.has(key);
    if (on) state.following.add(key); else state.following.delete(key);
    $$(`[data-follow="${key}"]`).forEach((b) => { ($('.a-btn__label', b) || b).textContent = on ? 'Đang theo dõi' : 'Theo dõi'; b.classList.toggle('is-sent', on); });
    M.pulse(btn, 1.06);
    if (on) M.toast(`Đã theo dõi ${PEOPLE[key].name}. Việc làm mới của họ sẽ hiện trên Bảng tin.`);
  }

  /* ---------------------------------------------------------------------------
     GỢI Ý @NHẮC TÊN (ô bình luận, ô tạo bài, ô sửa bài)
     --------------------------------------------------------------------------- */
  const MP = { el: $('#mentionPop'), ta: null, hits: [], i: 0, start: -1 };
  function wireMentions(ta) {
    ta.addEventListener('input', () => mentionQuery(ta));
    ta.addEventListener('keydown', (e) => {
      if (MP.el.hidden || MP.ta !== ta) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); MP.i = (MP.i + (e.key === 'ArrowDown' ? 1 : -1) + MP.hits.length) % MP.hits.length; mentionRender(); }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); mentionPick(MP.i); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); mentionClose(); }
    });
    ta.addEventListener('blur', () => setTimeout(() => { if (MP.ta === ta) mentionClose(); }, 150));
  }
  function mentionQuery(ta) {
    const upto = ta.value.slice(0, ta.selectionStart);
    const m = /(^|\s)@([\p{L}\d_]{0,20})$/u.exec(upto);
    if (!m) { mentionClose(); return; }
    const q = norm(m[2]);
    MP.hits = FRIENDS().filter((k) => !q || norm(PEOPLE[k].name).split(/\s+/).some((w) => w.startsWith(q))).slice(0, 5);
    if (!MP.hits.length) { mentionClose(); return; }
    const wasHidden = MP.el.hidden;
    MP.ta = ta;
    MP.start = upto.length - m[2].length - 1;
    MP.i = 0;
    mentionRender();
    MP.el.hidden = false;
    const r = ta.getBoundingClientRect();
    const h = MP.el.offsetHeight;
    let top = r.bottom + 6;
    if (top + h > innerHeight - 8) top = r.top - h - 6;
    MP.el.style.left = Math.max(8, Math.min(r.left, innerWidth - MP.el.offsetWidth - 8)) + 'px';
    MP.el.style.top = top + 'px';
    if (wasHidden) M.pop(MP.el, null);
  }
  function mentionRender() {
    MP.el.innerHTML = MP.hits.map((k, i) => `<div class="a-menu__item" role="option" id="mp-${i}" data-i="${i}" data-active="${i === MP.i}" aria-selected="${i === MP.i}">${face(k, 28)}<span>${esc(PEOPLE[k].name)}<small>${esc(PEOPLE[k].role)}</small></span></div>`).join('');
    if (MP.ta) MP.ta.setAttribute('aria-activedescendant', 'mp-' + MP.i);
  }
  function mentionPick(i) {
    const ta = MP.ta;
    const name = PEOPLE[MP.hits[i]].name;
    const caret = ta.selectionStart;
    ta.value = ta.value.slice(0, MP.start) + '@' + name + ' ' + ta.value.slice(caret);
    const pos = MP.start + name.length + 2;
    mentionClose();
    ta.focus();
    ta.setSelectionRange(pos, pos);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function mentionClose() { if (MP.ta) MP.ta.removeAttribute('aria-activedescendant'); MP.el.hidden = true; MP.ta = null; }
  MP.el.addEventListener('mousedown', (e) => { const it = e.target.closest('[data-i]'); if (it) { e.preventDefault(); mentionPick(+it.dataset.i); } });

  /* ---------------------------------------------------------------------------
     CHI TIẾT BÀI + BÌNH LUẬN — desktop: modal ảnh | bình luận; mobile: bottom sheet
     --------------------------------------------------------------------------- */
  const pd = $('#postDialog');
  const pdScrim = $('#pdScrim');
  let pdPost = null;
  let replyTo = null;
  const EMO = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

  function cmtHtml(c, isReply) {
    const a = PEOPLE[c.who];
    return `<div class="cmt${isReply ? ' cmt--reply' : ''}" id="c-${c.id}">
      <button class="cmt__face" type="button" data-hover="${c.who}" aria-label="${esc(a.name)}">${face(c.who, isReply ? 24 : 32)}</button>
      <div>
        <div class="cmt__body"><a class="cmt__name" href="#" data-hover="${c.who}">${esc(a.name)}</a>${richText(c.text)}</div>
        <div class="cmt__meta"><span>${timeAgo(c.mins)}</span><span class="cmt__likes"${c.likes ? '' : ' hidden'}><span class="a-num">${c.likes}</span> lượt thích</span>
          <button type="button" data-reply="${c.id}">Trả lời</button>${c.who === 'me' ? `<button type="button" data-cdel="${c.id}">Xoá</button>` : ''}</div>
        ${!isReply && c.replies.length ? `<button class="cmt__more" type="button" data-replies aria-expanded="false">Xem ${c.replies.length} câu trả lời</button>
          <div class="a-collapse cmt__replies" data-open="false"><div class="a-collapse__inner">${c.replies.map((r) => cmtHtml(r, true)).join('')}</div></div>` : ''}
      </div>
      <button class="cmt__like" type="button" data-clike="${c.id}" aria-pressed="${c.liked}" aria-label="Thích bình luận"><i data-lucide="heart"></i></button>
    </div>`;
  }
  const cmtSkel = () => Array.from({ length: 3 }, () => '<div class="cmt-skel" aria-hidden="true"><span class="a-skel" style="width:32px;height:32px;border-radius:50%"></span><div><span class="a-skel" style="height:12px;width:80%"></span><span class="a-skel" style="height:10px;width:35%"></span></div></div>').join('');

  function openPost(p, origin, opts = {}) {
    pdPost = p;
    replyTo = null;
    pd.dataset.pid = p.id;
    pd.classList.toggle('pd--text', !p.media);
    const a = PEOPLE[p.who];
    pd.innerHTML = `
      ${p.media ? `<div class="pd__media">${carHtml(p, true)}</div>` : ''}
      <div class="pd__side">
        <header class="pd__head">
          <button class="post__face" type="button" data-hover="${p.who}">${face(p.who, 32)}</button>
          <div class="post__who"><div class="post__name"><a href="#" data-hover="${p.who}">${esc(a.name)}</a></div><div class="post__sub">${esc(a.role)}</div></div>
          <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-menu aria-label="Tuỳ chọn bài viết" aria-haspopup="menu"><i data-lucide="more-horizontal"></i></button>
          <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-pd-close aria-label="Đóng (Esc)"><i data-lucide="x"></i></button>
        </header>
        <div class="pd__mhead">Bình luận</div>
        <div class="pd__scroll" id="pdScroll">
          ${(p.text || p.title) ? `<div class="cmt cmt--caption">${face(p.who, 32)}<div><div class="cmt__body"><a class="cmt__name" href="#" data-hover="${p.who}">${esc(a.name)}</a>${p.title ? `<span class="cmt__title">${esc(p.title)}</span>` : ''}${richText(p.text)}</div><div class="cmt__meta"><span>${timeAgo(p.mins)}${p.edited ? ' · đã sửa' : ''}</span></div></div><span></span></div>` : ''}
          <div id="pdComments" aria-live="polite" aria-busy="true">${cmtSkel()}</div>
        </div>
        <div class="pd__foot">
          <div class="post__actions">
            <button class="act act--like" type="button" data-like aria-pressed="${p.liked}" aria-label="${p.liked ? 'Bỏ thích' : 'Thích'}"><i data-lucide="heart"></i></button>
            <button class="act" type="button" data-comments aria-label="Viết bình luận"><i data-lucide="message-circle"></i></button>
            <button class="act" type="button" data-share aria-label="Gửi cho bạn bè"><i data-lucide="send"></i></button>
            <button class="act act--save" type="button" data-save aria-pressed="${p.saved}" aria-label="${p.saved ? 'Bỏ lưu' : 'Lưu bài viết'}"><i data-lucide="bookmark"></i></button>
          </div>
          <div class="post__likes" data-likes>${likesHtml(p)}</div>
          <div class="pd__time">${fullDate(p.mins)}</div>
          <div class="qemoji" role="group" aria-label="Chèn nhanh biểu tượng cảm xúc">${EMO.map((x) => `<button type="button" data-emo="${x}" aria-label="Chèn ${x}">${x}</button>`).join('')}</div>
          <div class="replying" id="pdReplying" hidden></div>
          <form class="pd__form" id="pdForm" autocomplete="off">
            ${face('me', 32)}
            <textarea class="pd__input" id="pdInput" rows="1" placeholder="Thêm bình luận… Gõ @ để nhắc tên" aria-label="Viết bình luận" maxlength="1000"></textarea>
            <button class="post__qsend" type="submit" id="pdSend" disabled>Đăng</button>
          </form>
        </div>
      </div>`;
    renderIcons();
    const car = $('.car', pd);
    M.openDialog(pd, pdScrim, origin);
    if (car) {
      wireCarousel(car);
      const feedCar = $(`#post-${p.id} .car`);
      const idx = feedCar ? +(feedCar.dataset.idx || 0) : 0;
      requestAnimationFrame(() => car.goTo(idx));
    }
    const ta = $('#pdInput');
    wireMentions(ta); /* phải gắn TRƯỚC listener Enter-để-gửi bên dưới */
    ta.addEventListener('input', () => { autosize(ta, 96); $('#pdSend').disabled = !ta.value.trim(); });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); $('#pdForm').requestSubmit(); }
    });
    $('#pdForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      addComment(p, text, replyTo);
      ta.value = '';
      autosize(ta, 96);
      $('#pdSend').disabled = true;
      clearReply();
    });
    if (opts.focus) setTimeout(() => ta.focus(), 320);
    setTimeout(() => renderPdComments(p), window.__slowLoad ? 3000 : 450); /* GET /Dashboard/GetComments?postId= */
  }
  function renderPdComments(p) {
    const box = $('#pdComments');
    if (!box || pdPost !== p) return;
    box.innerHTML = p.comments.length ? p.comments.map((c) => cmtHtml(c)).join('')
      : '<div class="a-empty" style="padding:32px 8px"><i data-lucide="message-circle"></i><div class="a-empty__title">Chưa có bình luận</div><div class="a-empty__text">Hãy là người đầu tiên bình luận.</div></div>';
    box.setAttribute('aria-busy', 'false');
    renderIcons();
    M.stagger($$(':scope > .cmt', box));
  }
  function insertDialogComment(p, c, parent) {
    const box = $('#pdComments');
    if (!box || box.getAttribute('aria-busy') === 'true') return;
    const empty = $('.a-empty', box);
    if (empty) empty.remove();
    if (parent) {
      const pEl = $('#c-' + parent.id, box);
      pEl.outerHTML = cmtHtml(parent);
      const col = $(`#c-${parent.id} .cmt__replies`, box);
      col.dataset.open = 'true';
      const tog = $(`#c-${parent.id} [data-replies]`, box);
      tog.setAttribute('aria-expanded', 'true');
      tog.textContent = 'Ẩn câu trả lời';
    } else box.insertAdjacentHTML('beforeend', cmtHtml(c));
    renderIcons();
    const el = $('#c-' + c.id, box);
    el.scrollIntoView({ block: 'nearest', behavior: M.reduced() ? 'auto' : 'smooth' });
    M.highlight(el);
  }
  async function closePost() {
    if (pd.hidden) return;
    mentionClose();
    await M.closeDialog(pd, pdScrim);
    pdPost = null;
    delete pd.dataset.pid;
    pd.innerHTML = '';
  }
  pdScrim.addEventListener('click', closePost);

  function findComment(id) {
    for (const p of state.posts) {
      for (const c of p.comments) {
        if (c.id === id) return { p, c, parent: null };
        for (const r of c.replies) if (r.id === id) return { p, c: r, parent: c };
      }
    }
    return null;
  }
  /* [CẦN BACKEND] POST /Comments/{id}/Like */
  function likeComment(id) {
    const f = findComment(id);
    if (!f) return;
    const c = f.c;
    c.liked = !c.liked;
    c.likes += c.liked ? 1 : -1;
    $$(`[data-clike="${id}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', String(c.liked));
      M.animate($('svg', b), [{ transform: 'scale(1)' }, { transform: `scale(${c.liked ? 1.4 : .8})` }, { transform: 'scale(1)' }], { duration: 380, easing: M.SPRING });
    });
    const meta = $(`#c-${id} .cmt__likes`);
    if (meta) { meta.hidden = !c.likes; M.rollNumber($('.a-num', meta), c.likes); }
  }
  function startReply(id) {
    const f = findComment(id);
    if (!f) return;
    replyTo = f.parent || f.c;
    const who = PEOPLE[f.c.who];
    const r = $('#pdReplying');
    r.innerHTML = `<span>Đang trả lời <b>${esc(who.name)}</b></span><button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-reply-x aria-label="Huỷ trả lời"><i data-lucide="x"></i></button>`;
    if (r.hidden) { r.hidden = false; M.animate(r, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: M.EASE_OUT }); }
    renderIcons();
    const ta = $('#pdInput');
    const tag = '@' + who.name + ' ';
    if (f.c.who !== 'me' && !ta.value.startsWith(tag)) ta.value = tag + ta.value;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.dispatchEvent(new Event('input'));
  }
  function clearReply() { replyTo = null; const r = $('#pdReplying'); if (r) r.hidden = true; }
  function toggleReplies(b) {
    const col = b.nextElementSibling;
    const open = col.dataset.open !== 'true';
    M.toggle(col);
    b.setAttribute('aria-expanded', String(open));
    b.textContent = open ? 'Ẩn câu trả lời' : `Xem ${$$('.cmt', col).length} câu trả lời`;
  }
  /* [CẦN BACKEND] DELETE /Comments/{id} — gọi sau khi hết thời gian Hoàn tác */
  async function deleteComment(id) {
    const f = findComment(id);
    if (!f) return;
    const arr = f.parent ? f.parent.replies : f.p.comments;
    const idx = arr.indexOf(f.c);
    arr.splice(idx, 1);
    f.p.commentCount--;
    const el = $('#c-' + id);
    if (el) await M.removeFrom(el.parentElement, el, { selector: ':scope > .cmt' });
    syncCounts(f.p);
    patchPreviews(f.p);
    M.toast('Đã xoá bình luận.', { action: { label: 'Hoàn tác', onClick: () => { arr.splice(idx, 0, f.c); f.p.commentCount++; syncCounts(f.p); patchPreviews(f.p); if (pdPost === f.p) renderPdComments(f.p); } } });
  }
  function insertAtCaret(ta, s) {
    if (!ta) return;
    const a = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, a) + s + ta.value.slice(ta.selectionEnd ?? a);
    ta.focus();
    ta.setSelectionRange(a + s.length, a + s.length);
    ta.dispatchEvent(new Event('input'));
  }

  /* ---------------------------------------------------------------------------
     GỬI CHO BẠN BÈ — ChatHub.SendMessage tới từng người (kèm link bài)
     --------------------------------------------------------------------------- */
  const share = $('#shareDialog');
  const shareScrim = $('#shareScrim');
  let shareSel = [];
  let sharePost = null;
  const sharePHtml = (k) => `<button class="share__p" type="button" data-sp="${k}" aria-pressed="false">${face(k, 56)}<span class="share__check" aria-hidden="true"><i data-lucide="check"></i></span><span>${esc(PEOPLE[k].name)}</span></button>`;
  function openShare(p, origin) {
    sharePost = p;
    shareSel = [];
    share.innerHTML = `
      <div class="a-dialog__head"><h2 class="a-dialog__title" id="shareTitle">Chia sẻ</h2><button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-share-close aria-label="Đóng"><i data-lucide="x"></i></button></div>
      <div class="a-dialog__body">
        <label class="a-search share__search"><i data-lucide="search"></i><input class="a-input" id="shareQ" type="search" placeholder="Tìm bạn bè" autocomplete="off" aria-label="Tìm bạn bè"></label>
        <div class="share__grid" id="shareGrid" role="group" aria-label="Chọn người nhận">${FRIENDS().map(sharePHtml).join('')}</div>
        <div class="a-collapse" id="shareMsgWrap" data-open="false"><div class="a-collapse__inner"><input class="a-input share__msg" id="shareMsg" placeholder="Viết lời nhắn…" maxlength="500" aria-label="Lời nhắn"></div></div>
      </div>
      <div class="share__apps" id="shareApps">
        <button class="share__app" type="button" data-share-copy><span><i data-lucide="link"></i></span><span>Sao chép liên kết</span></button>
        <button class="share__app" type="button" data-share-repost><span><i data-lucide="repeat-2"></i></span><span>Đăng lại lên Bảng tin</span></button>
        <button class="share__app" type="button" data-share-native><span><i data-lucide="share"></i></span><span>Chia sẻ khác</span></button>
      </div>
      <div class="a-dialog__foot" id="shareFoot" hidden><button class="a-btn a-btn--primary a-btn--block" type="button" id="shareSend">Gửi</button></div>`;
    renderIcons();
    M.openDialog(share, shareScrim, origin);
    setTimeout(() => $('#shareQ').focus(), 60);
    $('#shareQ').addEventListener('input', (e) => {
      const q = norm(e.target.value.trim());
      M.flip($('#shareGrid'), () => $$('.share__p', share).forEach((b) => { b.hidden = !!q && !norm(PEOPLE[b.dataset.sp].name).includes(q); }), { selector: '.share__p:not([hidden])' });
    });
    $('#shareMsg').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) $('#shareSend').click(); });
  }
  share.addEventListener('click', async (e) => {
    const t = e.target;
    let b;
    if (t.closest('[data-share-close]')) { closeShare(); return; }
    if ((b = t.closest('[data-sp]'))) {
      const k = b.dataset.sp;
      const on = !shareSel.includes(k);
      shareSel = on ? [...shareSel, k] : shareSel.filter((x) => x !== k);
      b.setAttribute('aria-pressed', String(on));
      M.animate($('.a-avatar, .a-logo', b), [{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 300, easing: M.SPRING });
      const any = shareSel.length > 0;
      $('#shareApps').hidden = any;
      $('#shareFoot').hidden = !any;
      if (any !== ($('#shareMsgWrap').dataset.open === 'true')) M.toggle($('#shareMsgWrap'));
      ($('.a-btn__label', $('#shareSend')) || $('#shareSend')).textContent = shareSel.length > 1 ? `Gửi riêng cho ${shareSel.length} người` : 'Gửi';
      return;
    }
    if ((b = t.closest('#shareSend'))) {
      M.morphButton(b, 'loading');
      await api(700);
      M.morphButton(b, 'success', { hold: true });
      await sleep(400);
      const who = shareSel.slice();
      await closeShare();
      M.toast(who.length > 1 ? `Đã gửi cho ${who.length} người.` : `Đã gửi cho ${PEOPLE[who[0]].name}.`, { tone: 'success', action: { label: 'Mở tin nhắn', onClick: () => { location.href = 'chat.html?userId=' + PEOPLE[who[0]].id; } } });
      return;
    }
    if ((b = t.closest('[data-share-copy]'))) { copyLink(sharePost, b); return; }
    if (t.closest('[data-share-repost]')) { /* [CẦN BACKEND] POST /Posts/{id}/Repost */ await closeShare(); M.toast('Đã đăng lại lên Bảng tin của bạn.', { action: { label: 'Hoàn tác', onClick() {} } }); return; }
    if (t.closest('[data-share-native]')) {
      const url = `${location.origin}${location.pathname}?post=${sharePost.id}`;
      if (navigator.share) navigator.share({ title: 'Bài viết trên Aris', url }).catch(() => {}); else copyLink(sharePost);
    }
  });
  async function closeShare() { if (share.hidden) return; await M.closeDialog(share, shareScrim); }
  shareScrim.addEventListener('click', closeShare);

  /* ---------------------------------------------------------------------------
     TẠO BÀI VIẾT — 3 bước: chọn ảnh → sắp xếp (kéo-thả, tỉ lệ) → nội dung
     POST /Dashboard/CreatePost (content, title, mediaFiles[]).
     [CẦN BACKEND] thứ tự ảnh (PostMedias.SortOrder), tỉ lệ khung (Posts.AspectRatio), bình chọn, tin 24h.
     --------------------------------------------------------------------------- */
  const cmD = $('#composeDialog');
  const cmScrim = $('#composeScrim');
  const cmFile = $('#cmFile');
  let cm = null;
  const newCm = (mode, story) => ({ mode, story: !!story, step: mode === 'media' ? 'pick' : 'write', media: [], ar: story ? '9 / 16' : '4 / 5', active: 0, title: '', showTitle: false, text: '', audience: 'public', poll: { q: '', opts: ['', ''], days: 3 } });
  window.ArisCompose = (origin) => openCompose('media', origin);

  function openCompose(mode, origin, opts = {}) {
    if (cm && !cmD.hidden) return;
    cm = newCm(mode, opts.story);
    if (opts.sample) addSamples(true);
    renderCm();
    M.openDialog(cmD, cmScrim, origin);
  }
  const cmDirty = () => cm && (cm.media.length || cm.text.trim() || cm.title.trim() || cm.poll.q.trim());
  async function closeCompose(published) {
    if (!cm) return;
    if (!published && cmDirty()) { const ok = await confirmDiscard(); if (!ok) return; }
    if (!published) cm.media.forEach((m) => { if (m.blob) URL.revokeObjectURL(m.src); });
    mentionClose();
    await M.closeDialog(cmD, cmScrim);
    cm = null;
    cmD.style.width = '';
  }
  cmScrim.addEventListener('click', () => closeCompose());

  function renderCm(dir) {
    const s = cm.step;
    const title = cm.story ? (s === 'pick' ? 'Tạo tin 24 giờ' : 'Xem trước tin')
      : cm.mode === 'poll' ? 'Tạo bình chọn'
      : ({ pick: 'Tạo bài viết mới', arrange: 'Sắp xếp ảnh', write: cm.mode === 'text' ? 'Tạo bài viết' : 'Viết chú thích' })[s];
    const canBack = s === 'write' && cm.mode === 'media';
    const next = s === 'pick' ? '' : s === 'arrange' ? (cm.story ? 'Chia sẻ tin' : 'Tiếp') : 'Đăng';
    const w0 = cmD.hidden ? 0 : cmD.offsetWidth;
    cmD.innerHTML = `
      <div class="a-dialog__head">
        ${canBack ? '<button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-cm-back aria-label="Quay lại bước sắp xếp ảnh"><i data-lucide="arrow-left"></i></button>'
          : '<button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-cm-close aria-label="Đóng"><i data-lucide="x"></i></button>'}
        <h2 class="a-dialog__title" id="cmTitle">${title}</h2>
        ${next ? `<button class="a-btn a-btn--primary a-btn--sm" type="button" data-cm-next>${next}</button>` : '<span style="width:32px" aria-hidden="true"></span>'}
      </div>
      <div class="cm__body${dir ? ' cm-step-in-' + dir : ''}">${s === 'pick' ? pickHtml() : s === 'arrange' ? arrangeHtml() : writeHtml()}</div>`;
    renderIcons();
    cmD.style.width = s === 'write' && cm.mode === 'media' && !isMobile() ? 'min(900px, calc(100vw - 32px))' : '';
    if (w0) { const w1 = cmD.offsetWidth; if (w0 !== w1) M.animate(cmD, [{ width: w0 + 'px' }, { width: w1 + 'px' }], { duration: 300, easing: M.EASE_OUT }); }
    wireCm();
    validate();
  }
  function pickHtml() {
    return `<div class="cm-drop" id="cmDrop">
      <span class="cm-drop__icon"><i data-lucide="images"></i></span>
      <div class="cm-drop__title">${cm.story ? 'Chọn một ảnh cho tin 24 giờ' : 'Kéo ảnh và video vào đây'}</div>
      <div class="cm-drop__text">${cm.story ? 'Tin tự ẩn sau 24 giờ.' : 'Tối đa 10 tệp · có thể dán ảnh bằng Ctrl + V'}</div>
      <div class="cm-drop__actions">
        <button class="a-btn a-btn--primary" type="button" data-cm-pick>Chọn từ máy</button>
        <button class="a-btn a-btn--secondary" type="button" data-cm-sample title="Chỉ có trong bản thiết kế">Dùng ảnh mẫu</button>
      </div>
      ${cm.story ? '' : '<button class="a-btn a-btn--ghost a-btn--sm" type="button" data-cm-textonly><i data-lucide="type"></i>Chỉ viết chữ</button>'}
    </div>`;
  }
  const thumbHtml = (m, i) => `<div class="cm-thumb${i === cm.active ? ' is-active' : ''}" data-mid="${m.id}" role="button" tabindex="0" aria-label="Ảnh ${i + 1}${i === 0 ? ', ảnh bìa' : ''}. Kéo hoặc Alt + ← → để đổi thứ tự">${mediaEl(m)}<span class="cm-thumb__n">${i + 1}</span><button class="cm-thumb__x" type="button" data-cm-remove="${m.id}" aria-label="Bỏ ảnh ${i + 1}"><i data-lucide="x"></i></button></div>`;
  function arrangeHtml() {
    const m = cm.media[cm.active];
    return `<div class="cm-arrange">
      <div class="cm-frame" id="cmFrame">${mediaEl(m)}${cm.media.length > 1 ? `<span class="cm-frame__count a-num">${cm.active + 1}/${cm.media.length}</span>` : ''}</div>
      ${cm.story ? `<input class="a-input" id="cmStoryCap" placeholder="Thêm chữ lên tin (không bắt buộc)" maxlength="80" value="${esc(cm.text)}">` : `
      <div class="cm-tools">
        <div class="a-seg" role="tablist" aria-label="Tỉ lệ khung"><span class="a-seg__thumb"></span>${[['1 / 1', 'Vuông'], ['4 / 5', 'Dọc 4:5'], ['16 / 9', 'Ngang']].map(([v, l]) => `<button class="a-seg__btn" type="button" role="tab" data-ar="${v}" aria-selected="${cm.ar === v}">${l}</button>`).join('')}</div>
        <span class="a-help">Kéo để đổi thứ tự · ảnh đầu là ảnh bìa</span>
      </div>
      <div class="cm-strip" id="cmStrip">${cm.media.map(thumbHtml).join('')}${cm.media.length < 10 ? '<button class="cm-add" type="button" data-cm-pick aria-label="Thêm ảnh"><i data-lucide="plus"></i></button>' : ''}</div>`}
    </div>`;
  }
  function writeHtml() {
    const media = cm.mode === 'media' && cm.media.length;
    return `<div class="cm-write${media ? ' has-media' : ''}">
      ${media ? `<div class="cm-write__preview">${mediaEl(cm.media[0])}${cm.media.length > 1 ? `<span class="cm-frame__count a-num">1/${cm.media.length}</span>` : ''}</div>` : ''}
      <div class="cm-fields">
        <div class="cm-author">${face('me', 32)}<span>${esc(PEOPLE.me.name)}</span></div>
        ${cm.mode !== 'poll' ? `<div class="a-collapse" id="cmTitleWrap" data-open="${cm.showTitle}"><div class="a-collapse__inner"><input class="cm-title" id="cmTitleIn" placeholder="Tiêu đề bài viết" maxlength="120" value="${esc(cm.title)}" aria-label="Tiêu đề"></div></div>` : ''}
        <textarea class="cm-text${cm.mode === 'poll' ? ' cm-text--sm' : ''}" id="cmText" aria-label="Nội dung" maxlength="2200" placeholder="${cm.mode === 'poll' ? 'Giới thiệu câu hỏi (không bắt buộc)…' : media ? 'Viết chú thích… Gõ @ để nhắc tên bạn bè' : 'Bạn muốn chia sẻ điều gì? Gõ @ để nhắc tên, # để gắn chủ đề'}">${esc(cm.text)}</textarea>
        ${cm.mode === 'poll' ? pollEditorHtml() : ''}
        <div class="cm-sep"></div>
        <div class="cm-row">
          ${cm.mode !== 'poll' ? `<button class="a-btn a-btn--ghost a-btn--sm" type="button" data-cm-title aria-pressed="${cm.showTitle}"><i data-lucide="heading"></i>${cm.showTitle ? 'Bỏ tiêu đề' : 'Thêm tiêu đề'}</button>` : ''}
          ${cm.mode === 'text' ? '<button class="a-btn a-btn--ghost a-btn--sm" type="button" data-cm-addmedia><i data-lucide="image"></i>Thêm ảnh</button>' : ''}
          <span class="cm-count"><span class="a-num" id="cmCount">${cm.text.length}</span>/2.200</span>
        </div>
        <div class="cm-row">
          <span style="flex:1">Ai có thể xem</span>
          <div class="a-seg" role="tablist" aria-label="Ai có thể xem"><span class="a-seg__thumb"></span>
            <button class="a-seg__btn" type="button" role="tab" data-aud="public" aria-selected="${cm.audience === 'public'}"><i data-lucide="globe"></i>Mọi người</button>
            <button class="a-seg__btn" type="button" role="tab" data-aud="friends" aria-selected="${cm.audience === 'friends'}"><i data-lucide="users"></i>Bạn bè</button></div>
        </div>
      </div>
    </div>`;
  }
  function pollEditorHtml() {
    return `<div class="cm-poll" id="cmPoll">
      <input class="a-input" id="cmPollQ" placeholder="Câu hỏi của bạn" maxlength="140" value="${esc(cm.poll.q)}" aria-label="Câu hỏi">
      ${cm.poll.opts.map((o, i) => `<div class="cm-poll__opt"><input class="a-input" data-popt="${i}" placeholder="Lựa chọn ${i + 1}" maxlength="60" value="${esc(o)}" aria-label="Lựa chọn ${i + 1}">${cm.poll.opts.length > 2 ? `<button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-poll-rm="${i}" aria-label="Bỏ lựa chọn ${i + 1}"><i data-lucide="x"></i></button>` : ''}</div>`).join('')}
      ${cm.poll.opts.length < 4 ? '<button class="a-btn a-btn--ghost a-btn--sm" type="button" data-poll-add style="justify-self:start"><i data-lucide="plus"></i>Thêm lựa chọn</button>' : ''}
      <div class="cm-row"><span style="flex:1">Thời hạn bình chọn</span><select class="a-select" id="cmPollDays" style="width:140px;height:34px" aria-label="Thời hạn">${[[1, '1 ngày'], [3, '3 ngày'], [7, '1 tuần']].map(([v, l]) => `<option value="${v}"${cm.poll.days === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>`;
  }
  function wireCm() {
    const drop = $('#cmDrop');
    if (drop) {
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
      drop.addEventListener('dragleave', (e) => { if (!drop.contains(e.relatedTarget)) drop.classList.remove('is-over'); });
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); addFiles(e.dataTransfer.files); });
    }
    const strip = $('#cmStrip');
    if (strip) wireStrip(strip);
    if ($('#cmFrame')) requestAnimationFrame(() => sizeFrame(false));
    $$('.a-seg', cmD).forEach((seg) => M.segment(seg, $('[aria-selected="true"]', seg), { instant: true }));
    const text = $('#cmText');
    if (text) {
      wireMentions(text);
      text.addEventListener('input', () => { cm.text = text.value; M.rollNumber($('#cmCount'), text.value.length); autosize(text, 320); validate(); });
      text.addEventListener('paste', (e) => { const files = Array.from((e.clipboardData && e.clipboardData.files) || []); if (files.length) { e.preventDefault(); addFiles(files); } });
      autosize(text, 320);
    }
    const ti = $('#cmTitleIn');
    if (ti) ti.addEventListener('input', () => { cm.title = ti.value; validate(); });
    const sc = $('#cmStoryCap');
    if (sc) sc.addEventListener('input', () => { cm.text = sc.value; });
    const pq = $('#cmPollQ');
    if (pq) pq.addEventListener('input', () => { cm.poll.q = pq.value; validate(); });
    $$('[data-popt]', cmD).forEach((inp) => inp.addEventListener('input', () => { cm.poll.opts[+inp.dataset.popt] = inp.value; validate(); }));
    const days = $('#cmPollDays');
    if (days) days.addEventListener('change', () => { cm.poll.days = +days.value; });
    setTimeout(() => { if (cm && cm.step === 'write') (cm.mode === 'poll' ? $('#cmPollQ') : $('#cmText'))?.focus(); }, 60);
  }
  function validate() {
    const btn = $('[data-cm-next]', cmD);
    if (!btn) return;
    let ok = true;
    if (cm.step === 'arrange') ok = cm.media.length > 0;
    if (cm.step === 'write') {
      if (cm.mode === 'poll') ok = !!cm.poll.q.trim() && cm.poll.opts.filter((o) => o.trim()).length >= 2;
      else if (cm.mode === 'text') ok = !!(cm.text.trim() || (cm.showTitle && cm.title.trim()));
      else ok = cm.media.length > 0;
    }
    btn.disabled = !ok;
  }
  function sizeFrame(anim) {
    const f = $('#cmFrame');
    if (!f) return;
    const [a, b] = cm.ar.split('/').map(Number);
    const avail = f.parentElement.clientWidth - 32;
    const maxH = Math.min(innerHeight * .5, 470);
    let w = avail;
    let h = w * b / a;
    if (h > maxH) { h = maxH; w = h * a / b; }
    if (!anim) f.style.transition = 'none';
    f.style.width = w + 'px';
    f.style.height = h + 'px';
    f.style.justifySelf = 'center';
    if (!anim) { void f.offsetWidth; f.style.transition = ''; }
  }
  function addFiles(files) {
    const arr = Array.from(files).filter((f) => /^(image|video)\//.test(f.type));
    if (!arr.length) { M.toast('Chỉ nhận ảnh hoặc video.', { tone: 'danger' }); return; }
    const max = cm.story ? 1 : 10;
    const room = max - cm.media.length;
    if (arr.length > room) M.toast(`Mỗi ${cm.story ? 'tin' : 'bài'} tối đa ${max} tệp — đã bỏ bớt ${arr.length - room} tệp.`);
    arr.slice(0, Math.max(0, room)).forEach((f) => cm.media.push({ id: nid++, src: URL.createObjectURL(f), kind: f.type.startsWith('video') ? 'video' : 'image', blob: true, alt: f.name }));
    goArrange();
  }
  function addSamples(silent) {
    const ks = cm.story ? ['office'] : ['team', 'desk', 'whiteboard'];
    ks.slice(0, (cm.story ? 1 : 10) - cm.media.length).forEach((s) => cm.media.push({ id: nid++, s, kind: 'image' }));
    cm.mode = 'media';
    if (silent) { cm.step = 'arrange'; return; }
    goArrange();
  }
  function goArrange() {
    cm.mode = 'media';
    if (cm.step === 'pick') { cm.step = 'arrange'; renderCm('next'); } else renderCm();
  }
  function setActive(i) {
    if (i < 0) return;
    cm.active = i;
    $$('.cm-thumb', cmD).forEach((t, k) => t.classList.toggle('is-active', k === i));
    const f = $('#cmFrame');
    const old = $('img, video', f);
    old.insertAdjacentHTML('afterend', mediaEl(cm.media[i]));
    old.remove();
    M.animate($('img, video', f), [{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
    const c = $('.cm-frame__count', f);
    if (c) c.textContent = `${i + 1}/${cm.media.length}`;
  }
  function renumber() {
    $$('.cm-thumb', cmD).forEach((t, k) => { $('.cm-thumb__n', t).textContent = k + 1; t.setAttribute('aria-label', `Ảnh ${k + 1}${k === 0 ? ', ảnh bìa' : ''}. Kéo hoặc Alt + ← → để đổi thứ tự`); });
    const c = $('#cmFrame .cm-frame__count');
    if (c) c.textContent = `${cm.active + 1}/${cm.media.length}`;
  }
  async function removeMedia(id, el) {
    const i = cm.media.findIndex((m) => m.id === id);
    const [m] = cm.media.splice(i, 1);
    if (m.blob) URL.revokeObjectURL(m.src);
    if (!cm.media.length) { cm.step = 'pick'; cm.active = 0; renderCm('back'); return; }
    if (i < cm.active || cm.active >= cm.media.length) cm.active = Math.max(0, cm.active - 1);
    await M.removeFrom($('#cmStrip'), el, { selector: '.cm-thumb, .cm-add' });
    renumber();
    setActive(cm.active);
  }
  /* Kéo-thả sắp xếp ảnh: dùng ArisMotion.sortable (bám con trỏ, FLIP nhường chỗ, Alt + ← → bằng bàn phím) */
  function syncOrder(strip) {
    const order = $$('.cm-thumb', strip).map((x) => +x.dataset.mid);
    const activeId = cm.media[cm.active].id;
    cm.media.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    cm.active = cm.media.findIndex((m) => m.id === activeId);
    renumber();
  }
  function wireStrip(strip) {
    M.sortable(strip, { selector: '.cm-thumb', axis: 'x', ignore: '.cm-thumb__x', onChange: () => syncOrder(strip) });
    strip.addEventListener('keydown', (e) => {
      const t = e.target.closest('.cm-thumb');
      if (t && !e.altKey && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActive($$('.cm-thumb', strip).indexOf(t)); }
    });
  }
  cmD.addEventListener('click', (e) => {
    const t = e.target;
    let b;
    if (t.closest('[data-cm-close]')) { closeCompose(); return; }
    if (t.closest('[data-cm-back]')) { cm.step = 'arrange'; renderCm('back'); return; }
    if ((b = t.closest('[data-cm-next]'))) {
      if (b.disabled) return;
      if (cm.step === 'arrange' && !cm.story) { cm.step = 'write'; renderCm('next'); return; }
      publish(b);
      return;
    }
    if (t.closest('[data-cm-pick]')) { cmFile.accept = cm.story ? 'image/*' : 'image/*,video/*'; cmFile.multiple = !cm.story; cmFile.click(); return; }
    if (t.closest('[data-cm-sample]')) { addSamples(); return; }
    if (t.closest('[data-cm-textonly]')) { cm.mode = 'text'; cm.step = 'write'; renderCm('next'); return; }
    if (t.closest('[data-cm-addmedia]')) { cm.mode = 'media'; cm.step = 'pick'; renderCm('back'); return; }
    if ((b = t.closest('[data-cm-remove]'))) { removeMedia(+b.dataset.cmRemove, b.closest('.cm-thumb')); return; }
    if ((b = t.closest('.cm-thumb'))) { setActive(cm.media.findIndex((m) => m.id === +b.dataset.mid)); return; }
    if ((b = t.closest('[data-ar]'))) { cm.ar = b.dataset.ar; $$('[data-ar]', cmD).forEach((x) => x.setAttribute('aria-selected', String(x === b))); M.segment(b.parentElement, b); sizeFrame(true); return; }
    if ((b = t.closest('[data-aud]'))) { cm.audience = b.dataset.aud; $$('[data-aud]', cmD).forEach((x) => x.setAttribute('aria-selected', String(x === b))); M.segment(b.parentElement, b); return; }
    if ((b = t.closest('[data-cm-title]'))) {
      cm.showTitle = !cm.showTitle;
      M.toggle($('#cmTitleWrap'));
      b.setAttribute('aria-pressed', String(cm.showTitle));
      b.innerHTML = `<i data-lucide="heading"></i>${cm.showTitle ? 'Bỏ tiêu đề' : 'Thêm tiêu đề'}`;
      renderIcons();
      if (cm.showTitle) setTimeout(() => $('#cmTitleIn').focus(), 60);
      validate();
      return;
    }
    if (t.closest('[data-poll-add]')) { cm.poll.opts.push(''); renderCm(); setTimeout(() => $(`[data-popt="${cm.poll.opts.length - 1}"]`).focus(), 80); return; }
    if ((b = t.closest('[data-poll-rm]'))) { cm.poll.opts.splice(+b.dataset.pollRm, 1); renderCm(); }
  });
  cmFile.addEventListener('change', () => { if (cm) addFiles(cmFile.files); cmFile.value = ''; });

  async function publish(btn) {
    const snap = cm;
    M.morphButton(btn, 'loading');
    await api(900);
    M.morphButton(btn, 'success', { hold: true });
    await sleep(420);
    if (snap.story) {
      state.myStory = { items: [{ src: mediaSrc(snap.media[0]), cap: snap.text.trim(), mins: 0 }] };
      await closeCompose(true);
      renderStories();
      M.pulse($('#storyMe .st__ring'), 1.1);
      M.toast('Đã chia sẻ tin. Tin tự ẩn sau 24 giờ.', { tone: 'success' });
      return;
    }
    const p = P({
      id: nid++, who: 'me', mins: 0, audience: snap.audience,
      title: snap.showTitle && snap.title.trim() ? snap.title.trim() : null,
      text: snap.text.trim(),
      media: snap.mode === 'media' && snap.media.length ? snap.media.map((m) => ({ src: mediaSrc(m), kind: m.kind })) : null,
      ar: snap.ar,
      poll: snap.mode === 'poll' ? { q: snap.poll.q.trim(), opts: snap.poll.opts.filter((o) => o.trim()).map((o) => [o.trim(), 0]), voted: null, days: snap.poll.days } : null
    });
    p.commentCount = 0;
    await closeCompose(true);
    await insertPosts([p], true);
    M.toast('Đã đăng bài viết.', { tone: 'success' });
  }
  /* Xác nhận bỏ nội dung đang soạn — nút an toàn ("Tiếp tục soạn") được focus sẵn */
  function confirmDiscard() {
    return new Promise((resolve) => {
      const d = $('#confirmDialog');
      const s = $('#confirmScrim');
      d.innerHTML = `<div class="confirm__body"><div class="confirm__title" id="confirmTitle">Bỏ bài viết này?</div><div class="confirm__text" id="confirmText">Nội dung bạn vừa soạn sẽ không được lưu.</div></div>
        <div class="confirm__btns"><button type="button" data-yes>Bỏ bài viết</button><button type="button" data-no>Tiếp tục soạn</button></div>`;
      M.openDialog(d, s, null);
      setTimeout(() => $('[data-no]', d).focus(), 40);
      const done = async (v) => { d.onclick = null; s.onclick = null; d.onkeydown = null; await M.closeDialog(d, s); resolve(v); };
      d.onclick = (e) => { if (e.target.closest('[data-yes]')) done(true); if (e.target.closest('[data-no]')) done(false); };
      s.onclick = () => done(false);
      d.onkeydown = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    });
  }
  async function insertPosts(ps, top) {
    if (!ps.length) return;
    if (top && scrollY > 200) { scrollTo({ top: 0, behavior: M.reduced() ? 'auto' : 'smooth' }); await sleep(M.reduced() ? 0 : 450); }
    const els = ps.map(makePost);
    M.flip(list, () => { if (top) list.prepend(...els); else list.append(...els); });
    if (top) state.posts.unshift(...ps); else state.posts.push(...ps);
    els.forEach(wireAll);
    renderIcons();
    if (top) els.forEach(ringFlash);
  }

  /* ---------------------------------------------------------------------------
     TIN 24 GIỜ — hàng avatar + trình xem (thanh tiến trình, giữ để dừng, chạm trái/phải, vuốt xuống để đóng)
     --------------------------------------------------------------------------- */
  const RING = '<svg class="st__svg" viewBox="0 0 68 68" aria-hidden="true"><circle cx="34" cy="34" r="33"/></svg>';
  const stHtml = (u) => `<div role="listitem" data-st-who="${u.who}"><button class="st" type="button" data-story="${u.who}" aria-label="Xem tin của ${esc(PEOPLE[u.who].name)}${u.seen ? ', đã xem' : ''}"><span class="st__ring${u.seen ? ' is-seen' : ''}">${RING}${face(u.who, 60)}</span><span class="st__name">${esc(shortName(u.who))}</span></button></div>`;
  function renderStories() {
    const t = $('#storyTrack');
    t.innerHTML = `<div role="listitem"><button class="st st--me${state.myStory ? ' has-story' : ''}" type="button" id="storyMe" data-mystory aria-label="${state.myStory ? 'Xem tin của bạn' : 'Tạo tin 24 giờ'}"><span class="st__ring">${RING}${face('me', 60)}<span class="st__plus" aria-hidden="true"><i data-lucide="plus"></i></span></span><span class="st__name">Tin của bạn</span></button></div>`
      + STORIES.map(stHtml).join('');
    renderIcons();
    syncStoryNav();
  }
  function syncStoryNav() {
    const t = $('#storyTrack');
    const max = t.scrollWidth - t.clientWidth;
    $('.stories__nav--prev').hidden = t.scrollLeft < 4;
    $('.stories__nav--next').hidden = t.scrollLeft > max - 4;
  }
  $('#storyTrack').addEventListener('scroll', syncStoryNav, { passive: true });
  $$('.stories__nav').forEach((b) => b.addEventListener('click', () => {
    const t = $('#storyTrack');
    t.scrollBy({ left: (b.classList.contains('stories__nav--next') ? 1 : -1) * t.clientWidth * .8, behavior: M.reduced() ? 'auto' : 'smooth' });
  }));

  const SV = { el: $('#story'), users: [], u: 0, i: 0, anim: null, userPaused: false, hold: false, typing: false, down: null };
  const storyUsers = () => (state.myStory ? [{ who: 'me', items: state.myStory.items, mine: true }] : []).concat(STORIES);
  async function openStory(who, origin) {
    const users = storyUsers();
    const u = users.findIndex((x) => x.who === who);
    if (u < 0 || !SV.el.hidden) return;
    const ring = origin && $('.st__ring, .sring', origin);
    if (ring && ring.classList.contains('st__ring')) { ring.classList.add('is-loading'); await sleep(M.reduced() ? 0 : 420); ring.classList.remove('is-loading'); }
    Object.assign(SV, { users, u, i: 0, userPaused: false, hold: false, typing: false, opener: document.activeElement });
    SV.el.hidden = false;
    buildStory();
    const frame = $('.story__frame', SV.el);
    const av = origin && $('.a-avatar, .a-logo', origin);
    if (av) {
      const r = av.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      M.animate(frame, [{ transform: `translate(${r.left + r.width / 2 - (f.left + f.width / 2)}px, ${r.top + r.height / 2 - (f.top + f.height / 2)}px) scale(${r.width / f.width})`, borderRadius: '50%' }, { transform: 'none', borderRadius: isMobile() ? '0px' : '16px' }], { duration: 380, easing: M.EASE_OUT });
    }
    M.animate(SV.el, [{ backgroundColor: 'rgb(14 15 17 / 0)' }, { backgroundColor: 'rgb(14 15 17 / 1)' }], { duration: 300, easing: M.EASE_OUT });
    frame.focus({ preventScroll: true });
    showItem();
  }
  function buildStory() {
    SV.el.innerHTML = `
      <button class="story__side story__side--prev" type="button" data-sv-prev aria-label="Tin trước (←)"><i data-lucide="chevron-left"></i></button>
      <div class="story__frame" tabindex="-1">
        <div class="story__media" id="svMedia"></div>
        <div class="story__shade-t"></div><div class="story__shade-b"></div>
        <div class="story__caption" id="svCap"></div>
        <a class="story__sticker" id="svSticker" hidden></a>
        <div class="story__tap"><button type="button" data-sv-prev aria-label="Tin trước"></button><button type="button" data-sv-next aria-label="Tin sau"></button></div>
        <div class="story__top"><div class="story__bars" id="svBars"></div><div class="story__head" id="svHead"></div></div>
        <div class="story__foot" id="svFoot"></div>
      </div>
      <button class="story__side story__side--next" type="button" data-sv-next aria-label="Tin sau (→)"><i data-lucide="chevron-right"></i></button>`;
    const frame = $('.story__frame', SV.el);
    frame.addEventListener('pointerdown', (e) => {
      if (e.target.closest('input, a, .story__head button, .story__foot button')) return;
      SV.down = { t: e.timeStamp, x: e.clientX, y: e.clientY };
      SV.hold = true;
      applyPause();
      SV.holdT = setTimeout(() => SV.el.classList.add('is-holding'), 220);
      frame.setPointerCapture(e.pointerId);
    });
    frame.addEventListener('pointermove', (e) => {
      if (!SV.down || e.pointerType === 'mouse') return;
      const dy = e.clientY - SV.down.y;
      if (dy > 0) frame.style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy / 1500, .15)})`;
    });
    const up = (e) => {
      if (!SV.down) return;
      const d = SV.down;
      SV.down = null;
      clearTimeout(SV.holdT);
      SV.el.classList.remove('is-holding');
      SV.hold = false;
      const dy = e.clientY - d.y;
      if (dy > 120 && e.pointerType !== 'mouse') { closeStory(); return; }
      if (frame.style.transform) { const from = frame.style.transform; frame.style.transform = ''; M.animate(frame, [{ transform: from }, { transform: 'none' }], { duration: 280, easing: M.SPRING }); }
      applyPause();
      if (e.type === 'pointerup' && e.timeStamp - d.t < 220 && Math.abs(dy) < 10) {
        const r = frame.getBoundingClientRect();
        if (e.clientX - r.left < r.width / 3) svPrev(); else svNext();
      }
    };
    frame.addEventListener('pointerup', up);
    frame.addEventListener('pointercancel', up);
  }
  function showItem() {
    const user = SV.users[SV.u];
    const it = user.items[SV.i];
    const a = PEOPLE[user.who];
    $('#svBars').innerHTML = user.items.map((_, k) => `<span class="story__bar${k < SV.i ? ' is-done' : ''}"><i></i></span>`).join('');
    $('#svHead').innerHTML = `${face(user.who, 32)}<span class="story__name">${esc(user.mine ? 'Tin của bạn' : a.name)}</span><span class="story__time">${timeAgo(it.mins)}</span>
      <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-sv-pause aria-label="${SV.userPaused ? 'Tiếp tục' : 'Tạm dừng'} (Space)"><i data-lucide="${SV.userPaused ? 'play' : 'pause'}"></i></button>
      <button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-sv-close aria-label="Đóng (Esc)"><i data-lucide="x"></i></button>`;
    $('#svMedia').innerHTML = `<img src="${it.src || scene(it.s)}" alt="${esc(it.cap || 'Tin của ' + a.name)}">`;
    M.animate($('#svMedia img'), [{ opacity: .4 }, { opacity: 1 }], { duration: 200 });
    $('#svCap').textContent = it.cap || '';
    const st = $('#svSticker');
    st.hidden = !it.link;
    if (it.link) { st.href = it.link.href; st.innerHTML = `<i data-lucide="briefcase"></i>${esc(it.link.label)}`; }
    const foot = $('#svFoot');
    if (user.mine) foot.innerHTML = '<div class="story__reply" style="font-size:13px;opacity:.85"><i data-lucide="eye" style="width:16px;height:16px"></i>&nbsp;12 người đã xem</div>';
    else if (!foot.dataset.who || foot.dataset.who !== user.who) {
      foot.dataset.who = user.who;
      foot.innerHTML = `<div class="story__react" id="svReact" hidden>${['😂', '😮', '😍', '😢', '👏', '🔥'].map((x) => `<button type="button" data-sv-emo="${x}" aria-label="Gửi ${x}">${x}</button>`).join('')}</div>
        <form class="story__reply" id="svForm" autocomplete="off"><input class="story__input" id="svInput" placeholder="Trả lời ${esc(shortName(user.who))}…" aria-label="Trả lời tin" maxlength="500">
          <button class="act act--like" type="button" data-sv-like aria-pressed="false" aria-label="Thích tin"><i data-lucide="heart"></i></button>
          <button class="act" type="submit" aria-label="Gửi"><i data-lucide="send"></i></button></form>`;
      const inp = $('#svInput');
      inp.addEventListener('focus', () => { SV.typing = true; applyPause(); const r = $('#svReact'); r.hidden = false; M.stagger($$('button', r), { step: 25 }); });
      inp.addEventListener('blur', () => setTimeout(() => { if (document.activeElement && document.activeElement.closest('#svReact')) return; SV.typing = false; applyPause(); const r = $('#svReact'); if (r) r.hidden = true; }, 120));
      $('#svForm').addEventListener('submit', (e) => { e.preventDefault(); if (!inp.value.trim()) return; inp.value = ''; inp.blur(); M.toast(`Đã gửi trả lời tới ${a.name}.`, { tone: 'success' }); /* ChatHub.SendMessage(userId, text + link tin) */ });
    }
    renderIcons();
    runBar();
  }
  function runBar() {
    if (SV.anim) SV.anim.cancel();
    const bar = $$('.story__bar i', SV.el)[SV.i];
    SV.anim = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 5000, easing: 'linear', fill: 'forwards' });
    SV.anim.onfinish = svNext;
    applyPause();
  }
  function applyPause() { if (!SV.anim) return; if (SV.userPaused || SV.hold || SV.typing) SV.anim.pause(); else if (SV.anim.playState === 'paused') SV.anim.play(); }
  function svNext() {
    const user = SV.users[SV.u];
    if (SV.i < user.items.length - 1) { SV.i++; showItem(); return; }
    markSeen(user);
    if (SV.u < SV.users.length - 1) { SV.u++; SV.i = 0; slideUser(1); } else closeStory();
  }
  function svPrev() {
    if (SV.i > 0) { SV.i--; showItem(); return; }
    if (SV.u > 0) { SV.u--; SV.i = SV.users[SV.u].items.length - 1; slideUser(-1); } else { SV.i = 0; showItem(); }
  }
  function slideUser(dir) {
    M.animate($('.story__frame', SV.el), [{ transform: `translateX(${dir * 48}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: M.EASE_OUT });
    showItem();
  }
  function markSeen(user) { if (user.mine) return; const s = STORIES.find((x) => x.who === user.who); if (s && !s.seen) { s.seen = true; s.dirty = true; } }
  async function closeStory() {
    if (SV.el.hidden) return;
    if (SV.anim) { SV.anim.onfinish = null; SV.anim.cancel(); SV.anim = null; }
    const user = SV.users[SV.u];
    if (SV.i === user.items.length - 1) markSeen(user);
    const btn = user.mine ? $('#storyMe') : $(`[data-story="${user.who}"]`);
    const av = btn && $('.a-avatar, .a-logo', btn);
    const frame = $('.story__frame', SV.el);
    const r = av && av.getBoundingClientRect();
    const visible = r && r.width > 0 && r.bottom > 0 && r.top < innerHeight;
    M.animate(SV.el, [{ backgroundColor: 'rgb(14 15 17 / 1)' }, { backgroundColor: 'rgb(14 15 17 / 0)' }], { duration: 260, fill: 'forwards' });
    let to = null;
    if (visible) { const f = frame.getBoundingClientRect(); to = `translate(${r.left + r.width / 2 - (f.left + f.width / 2)}px, ${r.top + r.height / 2 - (f.top + f.height / 2)}px) scale(${r.width / f.width})`; }
    await M.animate(frame, visible
      ? [{ transform: frame.style.transform || 'none' }, { transform: to, borderRadius: '50%', opacity: .5 }]
      : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 300, easing: M.EASE_IN_OUT, fill: 'forwards' }).finished.catch(() => {});
    SV.el.hidden = true;
    SV.el.getAnimations().forEach((x) => x.cancel());
    SV.el.innerHTML = '';
    SV.el.classList.remove('is-holding');
    reorderSeen();
    const back = btn || SV.opener;
    if (back && back.isConnected) back.focus({ preventScroll: true });
  }
  /* Tin đã xem: vòng chuyển xám, avatar trượt về cuối hàng (FLIP) */
  function reorderSeen() {
    const dirty = STORIES.filter((s) => s.dirty);
    if (!dirty.length) return;
    const t = $('#storyTrack');
    dirty.forEach((s) => {
      s.dirty = false;
      const li = $(`[data-st-who="${s.who}"]`, t);
      $('.st__ring', li).classList.add('is-seen');
      $('.st', li).setAttribute('aria-label', `Xem tin của ${PEOPLE[s.who].name}, đã xem`);
      $$(`.sring[data-sw="${s.who}"]`).forEach((x) => x.classList.add('is-seen'));
    });
    const order = STORIES.slice().sort((a, b) => a.seen - b.seen);
    STORIES.splice(0, STORIES.length, ...order);
    M.flip(t, () => order.forEach((s) => t.append($(`[data-st-who="${s.who}"]`, t))), { selector: '[role="listitem"]' });
  }
  SV.el.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('.story__tap') && e.detail !== 0) return; /* chạm chuột/tay đã xử lý ở pointerup; click ở đây chỉ cho bàn phím */
    if (t.closest('[data-sv-close]')) { closeStory(); return; }
    if (t.closest('[data-sv-prev]')) { svPrev(); return; }
    if (t.closest('[data-sv-next]')) { svNext(); return; }
    let b;
    if ((b = t.closest('[data-sv-pause]'))) { SV.userPaused = !SV.userPaused; b.innerHTML = `<i data-lucide="${SV.userPaused ? 'play' : 'pause'}"></i>`; b.setAttribute('aria-label', (SV.userPaused ? 'Tiếp tục' : 'Tạm dừng') + ' (Space)'); renderIcons(); applyPause(); return; }
    if ((b = t.closest('[data-sv-like]'))) { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); M.animate($('svg', b), [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 420, easing: M.SPRING }); return; }
    if ((b = t.closest('[data-sv-emo]'))) {
      const r = b.getBoundingClientRect();
      const f = document.createElement('span');
      f.className = 'story__float';
      f.textContent = b.dataset.svEmo;
      f.style.left = r.left + 'px';
      f.style.top = r.top + 'px';
      document.body.append(f);
      M.animate(f, [{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: 'translateY(-180px) scale(1.6)', opacity: 0 }], { duration: 900, easing: M.EASE_OUT }).finished.then(() => f.remove());
      if (M.reduced()) setTimeout(() => f.remove(), 300);
      M.toast(`Đã gửi ${b.dataset.svEmo} tới ${PEOPLE[SV.users[SV.u].who].name}.`);
      $('#svInput').blur();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (SV.el.hidden) return;
    const typing = e.target.closest('input');
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); if (typing) typing.blur(); else closeStory(); return; }
    if (typing) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); svNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); svPrev(); }
    else if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); $('[data-sv-pause]', SV.el).click(); }
  }, true);

  /* ---------------------------------------------------------------------------
     CỘT PHỤ: Việc cần làm · Gợi ý kết bạn · Việc phù hợp · số liệu trực tiếp
     --------------------------------------------------------------------------- */
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const WD_LONG = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  function icsUrl(iv) {
    if (iv.ics) return iv.ics;
    const pad = (n) => String(n).padStart(2, '0');
    const f = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
    const end = new Date(iv.when.getTime() + 45 * 60000);
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Aris//VI\r\nBEGIN:VEVENT\r\nUID:aris-iv-${iv.id}@aris\r\nDTSTAMP:${f(new Date())}\r\nDTSTART:${f(iv.when)}\r\nDTEND:${f(end)}\r\nSUMMARY:Phỏng vấn ${iv.company} — ${iv.job}\r\nLOCATION:${iv.mode}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    iv.ics = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    return iv.ics;
  }
  function ivHtml(iv) {
    const d = iv.when;
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}, ${WD_LONG[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
    return `<div class="todo" data-todo-id="iv-${iv.id}">
      <div class="todo__top">
        <div class="cal" aria-hidden="true"><div class="cal__m">${WD[d.getDay()]}</div><div class="cal__d">${d.getDate()}</div></div>
        <div class="todo__text">${iv.status === 'accepted' ? `Phỏng vấn với <b>${esc(iv.company)}</b>` : `<b>${esc(iv.company)}</b> mời bạn phỏng vấn`}<div class="todo__sub">${esc(iv.job)}</div><div class="todo__sub">${time} · ${esc(iv.mode)}</div></div>
      </div>
      ${iv.status === 'accepted'
        ? `<div class="todo__done"><i data-lucide="check-circle-2"></i>Đã nhận lời<a class="a-btn a-btn--ghost a-btn--sm" style="margin-left:auto" href="${icsUrl(iv)}" download="phong-van-${norm(iv.company).replace(/\s+/g, '-')}.ics"><i data-lucide="calendar-plus"></i>Thêm vào lịch</a></div>`
        : `<div class="todo__actions"><button class="a-btn a-btn--primary a-btn--sm" type="button" data-iv-accept="${iv.id}">Nhận lời</button><button class="a-btn a-btn--secondary a-btn--sm" type="button" data-iv-decline="${iv.id}">Từ chối</button></div>`}
    </div>`;
  }
  function reqHtml(r) {
    const a = PEOPLE[r.who];
    return `<div class="todo" data-todo-id="rq-${r.id}">
      <div class="todo__top">${face(r.who, 44)}<div class="todo__text"><a class="person__name" href="#" data-hover="${r.who}">${esc(a.name)}</a><div class="todo__sub">Muốn kết bạn · ${a.mutual} bạn chung</div></div></div>
      ${r.status === 'accepted'
        ? `<div class="todo__done"><i data-lucide="user-check"></i>Đã là bạn bè<a class="a-btn a-btn--ghost a-btn--sm" style="margin-left:auto" href="chat.html?userId=${a.id}"><i data-lucide="message-circle"></i>Nhắn tin</a></div>`
        : `<div class="todo__actions"><button class="a-btn a-btn--primary a-btn--sm" type="button" data-rq-accept="${r.id}">Chấp nhận</button><button class="a-btn a-btn--secondary a-btn--sm" type="button" data-rq-decline="${r.id}">Xoá</button></div>`}
    </div>`;
  }
  const pendingCount = () => state.todo.interviews.filter((x) => x.status === 'pending').length + state.todo.requests.filter((x) => x.status === 'pending').length;
  function renderTodo() {
    const prevBadge = $('#todoSide [data-todo-count]');
    const prev = prevBadge ? (prevBadge.dataset.value || prevBadge.textContent) : null;
    const n = pendingCount();
    const items = [...state.todo.interviews.map(ivHtml), ...state.todo.requests.map(reqHtml)];
    const badge = n ? `<span class="a-badge a-badge--accent a-num" data-todo-count>${n}</span>` : '';
    $('#todoSide').innerHTML = `<div class="side-sec__head">Việc cần làm ${badge}</div><div class="todo-list">${items.length ? items.join('') : '<div class="todo-empty"><i data-lucide="check-circle-2"></i><span>Không còn việc gì cần làm. Lời mời mới sẽ hiện ở đây.</span></div>'}</div>`;
    const mod = $('[data-module="todo"]');
    if (mod) { mod.hidden = !items.length; mod.innerHTML = `<div class="feed-module__head">Việc cần làm ${badge}</div><div class="hscroll todo-list">${items.join('')}</div>`; }
    renderIcons();
    if (prev !== null && n && +prev !== n) $$('[data-todo-count]').forEach((el) => { el.textContent = prev; el.dataset.value = prev; M.rollNumber(el, n); });
  }
  /* Đổi nội dung một thẻ Việc cần làm: render lại rồi co giãn chiều cao từ cũ sang mới */
  function todoSwap(fromEl) {
    const card = fromEl.closest('.todo');
    const key = card.dataset.todoId;
    const inSide = !!fromEl.closest('#todoSide');
    const h0 = card.offsetHeight;
    renderTodo();
    const el = $(`${inSide ? '#todoSide' : '[data-module="todo"]'} [data-todo-id="${key}"]`);
    if (!el) return;
    M.animate(el, [{ height: h0 + 'px', overflow: 'hidden' }, { height: el.offsetHeight + 'px', overflow: 'hidden' }], { duration: 300, easing: M.EASE_OUT });
    M.animate(el.lastElementChild, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: M.EASE_OUT });
  }
  async function todoRemove(fromEl, mutate, toastMsg, undo) {
    const card = fromEl.closest('.todo');
    await M.removeFrom(card.parentElement, card);
    mutate();
    renderTodo();
    M.toast(toastMsg, { action: { label: 'Hoàn tác', onClick: () => { undo(); renderTodo(); } } });
  }
  async function ivRespond(id, accept, btn) {
    const iv = state.todo.interviews.find((x) => x.id === id);
    if (accept) { /* POST /JobApplications/RespondToInterview (applicationId, accept: true) */
      M.morphButton(btn, 'loading');
      await api(700);
      M.morphButton(btn, 'success', { hold: true });
      await sleep(480);
      iv.status = 'accepted';
      todoSwap(btn);
      return;
    }
    const idx = state.todo.interviews.indexOf(iv);
    todoRemove(btn, () => state.todo.interviews.splice(idx, 1), `Đã từ chối lời mời phỏng vấn của ${iv.company}.`, () => state.todo.interviews.splice(idx, 0, iv));
  }
  async function rqRespond(id, accept, btn) {
    const r = state.todo.requests.find((x) => x.id === id);
    if (accept) { /* POST /Friends/AcceptRequest */
      M.morphButton(btn, 'loading');
      await api(600);
      M.morphButton(btn, 'success', { hold: true });
      await sleep(420);
      r.status = 'accepted';
      PEOPLE[r.who].friend = true;
      todoSwap(btn);
      return;
    }
    const idx = state.todo.requests.indexOf(r); /* POST /Friends/DeclineRequest — gọi sau khi hết Hoàn tác */
    todoRemove(btn, () => state.todo.requests.splice(idx, 1), `Đã xoá lời mời của ${PEOPLE[r.who].name}.`, () => state.todo.requests.splice(idx, 0, r));
  }

  /* [CẦN BACKEND] GET /Friends/Suggestions (bạn của bạn bè, cùng công ty/trường) */
  function renderSuggest() {
    const ks = state.suggest;
    const btn = (k, cls) => `<button class="${cls}${state.sentReq.has(k) ? ' is-sent' : ''}" type="button" data-add="${k}">${state.sentReq.has(k) ? 'Đã gửi' : 'Kết bạn'}</button>`;
    $('#suggestSide').innerHTML = ks.length ? `<div class="side-sec__head">Gợi ý kết bạn<a href="#people">Xem tất cả</a></div>
      <div class="sugg-list">${ks.map((k) => `<div class="person" data-sugg="${k}">${face(k, 40)}<div class="person__text"><a class="person__name" href="#" data-hover="${k}">${esc(PEOPLE[k].name)}</a><div class="person__sub">${PEOPLE[k].mutual} bạn chung · ${esc(PEOPLE[k].role)}</div></div>${btn(k, 'link-btn')}</div>`).join('')}</div>` : '';
    const mod = $('[data-module="suggest"]');
    if (mod) {
      mod.hidden = !ks.length;
      mod.innerHTML = `<div class="feed-module__head">Gợi ý kết bạn<a class="a-btn a-btn--ghost a-btn--sm" href="#people">Xem tất cả</a></div>
        <div class="hscroll">${ks.map((k) => `<div class="sugg-card" data-sugg="${k}"><button class="a-btn a-btn--ghost a-btn--icon a-btn--sm sugg-card__x" type="button" data-sugg-x="${k}" aria-label="Bỏ gợi ý ${esc(PEOPLE[k].name)}"><i data-lucide="x"></i></button>${face(k, 64)}<div class="sugg-card__name">${esc(PEOPLE[k].name)}</div><div class="sugg-card__sub">${PEOPLE[k].mutual} bạn chung · ${esc(PEOPLE[k].role)}</div>${btn(k, `a-btn ${state.sentReq.has(k) ? 'a-btn--secondary' : 'a-btn--primary'} a-btn--sm a-btn--block`)}</div>`).join('')}</div>`;
    }
    renderIcons();
  }
  async function dismissSugg(k, btn) {
    const card = btn.closest('.sugg-card');
    await M.removeFrom(card.parentElement, card);
    state.suggest = state.suggest.filter((x) => x !== k);
    renderSuggest();
  }
  const REC_JOBS = [
    { id: 1, title: 'Frontend Developer (React)', company: 'TechNova', salary: '25–35 triệu' },
    { id: 7, title: 'QA Engineer', company: 'Nexa Pay', salary: '20–30 triệu' },
    { id: 5, title: 'UI/UX Designer', company: 'Lumen Studio', salary: '18–28 triệu' }
  ];
  function renderJobs() {
    $('#jobsSide').innerHTML = `<div class="side-sec__head">Việc phù hợp với bạn<a href="jobs.html">Xem tất cả</a></div>
      ${REC_JOBS.map((j) => `<a class="side-job" href="jobs.html?job=${j.id}"><span class="a-logo a-logo--36" data-tone="${toneOf(j.company)}" aria-hidden="true">${orgInitials(j.company)}</span><div class="side-job__text"><div class="side-job__title">${esc(j.title)}</div><div class="side-job__sub">${esc(j.company)} · ${esc(j.salary)}</div></div></a>`).join('')}`;
  }
  /* GET /Dashboard/GetLiveStats mỗi 30 giây → số lăn */
  function live() {
    const j = $('#liveJobs');
    const o = $('#liveOnline');
    M.rollNumber(j, +(j.dataset.value || j.textContent) + (Math.random() < .4 ? 1 : 0));
    M.rollNumber(o, Math.max(1, +(o.dataset.value || o.textContent) + (Math.random() < .5 ? 1 : -1)));
  }

  /* ---------------------------------------------------------------------------
     BÀI MỚI (realtime) · CUỘN VÔ HẠN · KÉO ĐỂ LÀM MỚI · THANH ĐẦU MOBILE
     [CẦN BACKEND] SignalR "NewPost" (hoặc GET /Dashboard/GetPosts?after=) và GET /Dashboard/GetPosts?before=&take=
     --------------------------------------------------------------------------- */
  const pending = [];
  function showNewPill() {
    const ps = INCOMING.splice(0);
    if (!ps.length) return;
    pending.push(...ps);
    const pill = $('#newPill');
    $('#newPillAvs').innerHTML = [...new Set(pending.map((p) => p.who))].slice(0, 3).map((k) => face(k, 22)).join('');
    $('#newPillText').textContent = `${pending.length} bài mới`;
    renderIcons();
    if (pill.hidden) { pill.hidden = false; M.animate(pill, [{ transform: 'translateY(-16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: M.SPRING }); }
  }
  $('#newPill').addEventListener('click', async () => {
    const pill = $('#newPill');
    await M.animate(pill, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-12px)' }], { duration: 160, fill: 'forwards' }).finished.catch(() => {});
    pill.hidden = true;
    pill.getAnimations().forEach((a) => a.cancel());
    insertPosts(pending.splice(0).reverse(), true);
  });

  const skelHtml = () => '<div class="post-skel" aria-hidden="true"><div class="post-skel__head"><span class="a-skel" style="width:36px;height:36px;border-radius:50%"></span><div style="flex:1;display:grid;gap:6px"><span class="a-skel" style="height:12px;width:40%"></span><span class="a-skel" style="height:10px;width:25%"></span></div></div><span class="a-skel" style="aspect-ratio:4/5;border-radius:10px"></span><span class="a-skel" style="height:12px;width:70%"></span></div>';
  async function loadMore() {
    if (state.loading || state.ended || state.empty) return;
    if (!OLDER.length) { endFeed(); return; }
    state.loading = true;
    list.setAttribute('aria-busy', 'true');
    list.insertAdjacentHTML('beforeend', skelHtml());
    await sleep(window.__slowLoad ? 4000 : 800);
    $$('.post-skel', list).forEach((x) => x.remove());
    const batch = OLDER.splice(0, 2);
    state.posts.push(...batch);
    const els = batch.map(makePost);
    list.append(...els);
    els.forEach(wireAll);
    renderIcons();
    M.stagger(els);
    state.loading = false;
    list.setAttribute('aria-busy', 'false');
    if (!OLDER.length) endFeed();
  }
  /* "Bạn đã xem hết bài mới" nằm TRONG danh sách; bài cũ hơn nối tiếp bên dưới nó (như Instagram) */
  function endFeed() {
    if (state.ended) return;
    state.ended = true;
    const e = $('#feedEnd');
    list.append(e);
    e.hidden = false;
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { e.classList.add('is-in'); o.disconnect(); } }).observe(e);
  }
  $('#olderBtn').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    M.morphButton(b, 'loading');
    await sleep(800);
    const els = OLDEST.splice(0).map((p) => { state.posts.push(p); return makePost(p); });
    list.append(...els);
    els.forEach(wireAll);
    renderIcons();
    M.stagger(els);
    b.replaceWith(Object.assign(document.createElement('div'), { className: 'feed-end__text', textContent: 'Bạn đã xem hết mọi bài viết.' }));
  });
  new IntersectionObserver((es) => { if (es[0].isIntersecting) loadMore(); }, { rootMargin: '600px' }).observe($('#feedSentinel'));

  function renderEmptyFeed() {
    state.empty = true;
    $('#feedEnd').hidden = true;
    list.innerHTML = `<div class="feed-empty a-empty" style="max-width:none">
      <i data-lucide="users"></i>
      <div class="a-empty__title">Bảng tin của bạn còn trống</div>
      <div class="a-empty__text">Kết bạn hoặc theo dõi công ty để thấy bài viết, việc làm mới và tin 24 giờ của họ ở đây.</div>
      <div style="display:flex;gap:8px;margin-top:12px"><a class="a-btn a-btn--primary" href="#people">Tìm bạn bè</a><a class="a-btn a-btn--secondary" href="jobs.html">Xem việc làm</a></div>
    </div><section class="feed-module" data-module="suggest" style="display:block" aria-label="Gợi ý kết bạn"></section>`;
    renderSuggest();
    $('#suggestSide').hidden = true; /* gợi ý đã nằm giữa bảng tin, không lặp ở cột phụ */
    $$('#storyTrack [data-st-who]').forEach((x) => x.remove()); /* tài khoản mới: chưa có tin của bạn bè */
    syncStoryNav();
    renderIcons();
  }

  /* Kéo để làm mới (chỉ cảm ứng, chỉ khi đang ở đầu trang): nét quỹ đạo vẽ dần theo quãng kéo */
  (function pullToRefresh() {
    const el = $('#ptr');
    el.innerHTML = M.loaderSvg();
    const dash = $('.a-loader__dash', el);
    let y0 = null;
    let dist = 0;
    let busy = false;
    const blocked = () => busy || !isMobile() || scrollY > 0 || document.querySelector('.a-dialog:not([hidden]), .story:not([hidden]), .a-lightbox:not([hidden])');
    const reset = () => {
      const from = el.style.transform;
      el.style.transform = '';
      el.style.opacity = '';
      M.animate(el, [{ transform: from || 'translateY(-80px)', opacity: 1 }, { transform: 'translateY(-80px)', opacity: 0 }], { duration: 240, easing: M.EASE_IN });
    };
    addEventListener('touchstart', (e) => { if (blocked()) return; y0 = e.touches[0].clientY; dist = 0; }, { passive: true });
    addEventListener('touchmove', (e) => {
      if (y0 === null) return;
      dist = Math.min((e.touches[0].clientY - y0) * .5, 90);
      if (dist <= 0) return;
      el.style.opacity = String(Math.min(dist / 40, 1));
      el.style.transform = `translateY(${dist - 40}px) rotate(${dist * 3}deg)`;
      dash.style.strokeDashoffset = String(100 - Math.min(dist / 64, 1) * 100);
    }, { passive: true });
    addEventListener('touchend', async () => {
      if (y0 === null) return;
      y0 = null;
      if (dist < 64) { reset(); return; }
      busy = true;
      el.classList.add('is-refreshing');
      dash.style.strokeDashoffset = '';
      el.style.transform = 'translateY(20px)';
      await sleep(1100);
      const ps = INCOMING.splice(0).concat(pending.splice(0)).reverse();
      $('#newPill').hidden = true;
      el.classList.remove('is-refreshing');
      reset();
      busy = false;
      if (ps.length) insertPosts(ps, true); else M.toast('Bạn đã xem hết bài mới.');
    });
  })();

  let lastY = scrollY;
  addEventListener('scroll', () => {
    if (!isMobile()) return;
    const y = scrollY;
    if (Math.abs(y - lastY) < 6) return;
    $('#feedMhead').classList.toggle('is-hidden', y > lastY && y > 80);
    lastY = y;
  }, { passive: true });

  /* ---------------------------------------------------------------------------
     PHÍM TẮT
     --------------------------------------------------------------------------- */
  const KEYS = [['J', 'K', 'Bài tiếp / bài trước'], ['L', null, 'Thích bài đang xem'], ['C', null, 'Mở bình luận'], ['S', null, 'Lưu bài'], ['←', '→', 'Chuyển ảnh trong bài'], ['N', null, 'Tạo bài viết'], ['Ctrl', 'K', 'Tìm nhanh'], ['?', null, 'Danh sách phím tắt'], ['Esc', null, 'Đóng hộp thoại']];
  function openKeys(origin) {
    const d = $('#keysDialog');
    d.innerHTML = `<div class="a-dialog__head"><h2 class="a-dialog__title" id="keysTitle">Phím tắt trên Bảng tin</h2><button class="a-btn a-btn--ghost a-btn--icon a-btn--sm" type="button" data-keys-close aria-label="Đóng"><i data-lucide="x"></i></button></div>
      <div class="a-dialog__body">${KEYS.map(([a, b, l]) => `<div class="keys__row"><span>${l}</span><span><span class="a-kbd">${a}</span>${b ? `<span class="a-kbd">${b}</span>` : ''}</span></div>`).join('')}</div>`;
    renderIcons();
    M.openDialog(d, $('#keysScrim'), origin || null);
    d.onclick = (e) => { if (e.target.closest('[data-keys-close]')) closeKeys(); };
  }
  const closeKeys = () => M.closeDialog($('#keysDialog'), $('#keysScrim'));
  $('#keysScrim').addEventListener('click', closeKeys);

  const posts = () => $$('.post', list);
  function currentPost() {
    const a = document.activeElement && document.activeElement.closest('.post');
    if (a) return a;
    return posts().find((el) => el.getBoundingClientRect().bottom > 140) || null;
  }
  function movePost(dir) {
    const all = posts();
    const cur = currentPost();
    const i = cur ? all.indexOf(cur) : -1;
    const next = all[Math.max(0, Math.min(all.length - 1, i + dir))];
    if (!next) return;
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: 'start', behavior: M.reduced() ? 'auto' : 'smooth' });
  }
  function closeTop() {
    if (!$('#confirmDialog').hidden) return false;
    if (!cmD.hidden) { closeCompose(); return true; }
    if (!share.hidden) { closeShare(); return true; }
    if (!pd.hidden) { closePost(); return true; }
    if (!$('#keysDialog').hidden) { closeKeys(); return true; }
    if (!hc.hidden) { hideHc(); return true; }
    return false;
  }
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    if (e.key === 'Escape') { if (closeTop()) e.preventDefault(); return; }
    if (document.querySelector('.a-dialog:not([hidden]), .a-palette:not([hidden])') || window.isLightboxOpen() || !SV.el.hidden) return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'j' || k === 'k') { e.preventDefault(); movePost(k === 'j' ? 1 : -1); return; }
    if (e.key === '?') { e.preventDefault(); openKeys(); return; }
    const el = currentPost();
    const p = el && byId(+el.dataset.pid);
    if (!p) return;
    if (k === 'l') { e.preventDefault(); setLike(p, !p.liked); }
    else if (k === 'c') { e.preventDefault(); openPost(p, $('[data-comments]', el), { focus: true }); }
    else if (k === 's') { e.preventDefault(); toggleSave(p); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && $('.car', el)) { e.preventDefault(); $('.car', el).step(e.key === 'ArrowLeft' ? -1 : 1); }
  });

  /* ---------------------------------------------------------------------------
     SỰ KIỆN CHUNG (uỷ quyền)
     --------------------------------------------------------------------------- */
  document.addEventListener('click', (e) => {
    const t = e.target;
    const host = t.closest('[data-pid]');
    const p = host && byId(+host.dataset.pid);
    let b;
    if (p && t.closest('[data-like]')) { setLike(p, !p.liked); return; }
    if (p && (b = t.closest('[data-comments]'))) { if (host === pd) $('#pdInput').focus(); else openPost(p, b, { focus: b.classList.contains('act') }); return; }
    if (p && (b = t.closest('[data-share]'))) { openShare(p, b); return; }
    if (p && t.closest('[data-save]')) { toggleSave(p); return; }
    if (p && (b = t.closest('[data-menu]'))) { openMenu(b, p); return; }
    if (p && (b = t.closest('[data-vote]'))) { vote(p, +b.dataset.vote); return; }
    if (p && t.closest('[data-unvote]')) { unvote(p); return; }
    if ((b = t.closest('[data-more]'))) { expandText(b); return; }
    if ((b = t.closest('[data-car-step]'))) { b.closest('.car').step(+b.dataset.carStep); return; }
    if ((b = t.closest('[data-clike]'))) { likeComment(+b.dataset.clike); return; }
    if ((b = t.closest('[data-reply]'))) { startReply(+b.dataset.reply); return; }
    if (t.closest('[data-reply-x]')) { clearReply(); $('#pdInput').focus(); return; }
    if ((b = t.closest('[data-replies]'))) { toggleReplies(b); return; }
    if ((b = t.closest('[data-cdel]'))) { deleteComment(+b.dataset.cdel); return; }
    if ((b = t.closest('[data-emo]'))) { insertAtCaret($('#pdInput'), b.dataset.emo); return; }
    if (t.closest('[data-pd-close]')) { closePost(); return; }
    if ((b = t.closest('[data-add]'))) { e.preventDefault(); toggleAdd(b.dataset.add, b); return; }
    if ((b = t.closest('[data-follow]'))) { toggleFollow(b.dataset.follow, b); return; }
    if ((b = t.closest('[data-story]'))) { openStory(b.dataset.story, b); return; }
    if ((b = t.closest('[data-mystory]'))) { if (state.myStory) openStory('me', b); else openCompose('media', b, { story: true }); return; }
    if ((b = t.closest('[data-story-of]'))) { if (hasStory(b.dataset.storyOf)) { e.preventDefault(); openStory(b.dataset.storyOf, b); } return; }
    if ((b = t.closest('[data-compose]'))) { openCompose(b.dataset.compose, b); return; }
    if ((b = t.closest('[data-iv-accept]'))) { ivRespond(+b.dataset.ivAccept, true, b); return; }
    if ((b = t.closest('[data-iv-decline]'))) { ivRespond(+b.dataset.ivDecline, false, b); return; }
    if ((b = t.closest('[data-rq-accept]'))) { rqRespond(+b.dataset.rqAccept, true, b); return; }
    if ((b = t.closest('[data-rq-decline]'))) { rqRespond(+b.dataset.rqDecline, false, b); return; }
    if ((b = t.closest('[data-sugg-x]'))) { dismissSugg(b.dataset.suggX, b); return; }
    if (t.closest('a[href="#"]')) e.preventDefault();
  });
  $('#composeBar').addEventListener('click', (e) => { if (e.target.closest('.a-avatar')) location.hash = 'profile'; });

  /* ---------------------------------------------------------------------------
     DEMO + KHỞI TẠO
     --------------------------------------------------------------------------- */
  window.ArisDemo = [
    { icon: 'bell-ring', label: 'Có bài mới (realtime)', run: showNewPill },
    { icon: 'play-circle', label: 'Xem tin 24 giờ', run: () => openStory(STORIES[0].who, $(`[data-story="${STORIES[0].who}"]`)) },
    { icon: 'message-circle', label: 'Mở bình luận bài đầu tiên', run: () => openPost(state.posts[0], null) },
    { icon: 'images', label: 'Tạo bài với ảnh mẫu', run: () => openCompose('media', null, { sample: true }) },
    { icon: 'bar-chart-3', label: 'Tạo bình chọn', run: () => openCompose('poll', null) },
    { icon: 'wifi-off', label: 'Bật lỗi mạng khi Thích', run: () => { window.__failLike = true; M.toast('Đã bật lỗi mạng — thử bấm Thích một bài.'); } },
    { icon: 'inbox', label: 'Bảng tin trống (tài khoản mới)', run: renderEmptyFeed },
    { icon: 'keyboard', label: 'Xem phím tắt', run: () => openKeys() }
  ];

  document.addEventListener('DOMContentLoaded', () => {
    renderStories();
    renderFeed();
    renderTodo();
    renderSuggest();
    renderJobs();
    setInterval(live, 30000);
    if (params.has('empty')) renderEmptyFeed();
    if (params.has('new')) setTimeout(showNewPill, 500);
    else if (!params.has('still')) setTimeout(showNewPill, 15000);
    if (params.get('post')) { const p = byId(+params.get('post')); if (p) openPost(p, null, { focus: params.has('reply') }); }
    if (params.has('story')) setTimeout(() => { const s = STORIES[+params.get('story') || 0]; openStory(s.who, $(`[data-story="${s.who}"]`)); }, 200);
    const c = params.get('compose') || (location.hash === '#compose' ? 'media' : null);
    if (c) {
      openCompose(c === 'sample' || c === 'write' ? 'media' : c, null, { sample: c === 'sample' || c === 'write' });
      if (c === 'write') { cm.step = 'write'; cm.text = 'Buổi họp nhóm đầu tiên với @Lê Thu Hà và cả nhóm sản phẩm 🎉'; renderCm(); }
    }
    if (params.has('share')) openShare(state.posts[0], null);
    if (params.has('menu')) openMenu($('#post-1 [data-menu]'), state.posts[0]);
    if (params.has('keys')) openKeys();
    if (params.has('edit')) { const el = $('#post-5'); if (el) { el.scrollIntoView(); startEdit(byId(5)); } }
  });
})();
