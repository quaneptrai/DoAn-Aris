using ArisSkyve.Domain.Entities;
using ArisSkyve.Infrastructure.Data.Context;
using Microsoft.EntityFrameworkCore;

namespace ArisSkyve.Infrastructure.Data
{
    /// <summary>
    /// Dữ liệu mẫu để thử giao diện Bảng tin / Tin nhắn / Công ty (27/09/2026). CHỈ chạy ở Development (Program.cs).
    /// - Tài khoản chủ dự án (tohkadangyeu@gmail.com) + 6 người dùng mẫu + 6 trang công ty giới thiệu (thông tin công khai).
    /// - Bài đăng có ảnh / video (wwwroot/uploads/demo), thích, bình luận, bạn bè, lời mời kết bạn, tin nhắn, theo dõi công ty, thông báo.
    /// - Tin 24h được tạo lại mỗi lần khởi động nếu tin mẫu cũ đã hết hạn.
    /// Chỉ THÊM dữ liệu; mọi tài khoản mẫu dùng email @example.com nên dễ nhận ra và xoá về sau.
    /// Chạy một lần: bỏ qua phần nội dung nếu người dùng mẫu đầu tiên (Marker) đã tồn tại.
    /// </summary>
    public static class DemoSocialSeeder
    {
        private const string OwnerEmail = "tohkadangyeu@gmail.com";
        private const string Marker = "minhanh.demo@example.com";
        private const string Media = "/uploads/demo/";
        private const string SampleNote = "\n\n(Trang giới thiệu mẫu để thử giao diện Aris — thông tin tổng hợp từ nguồn công khai.)";

        private record Person(string Key, string Email, string Username, string FullName, string JobTitle, string Location, string Bio);
        private record Company(string Key, string Email, string Username, string Name, string Industry, int Founded, string? Size, string City, string Website, string Description, string Cover);

        private static readonly Person[] People =
        {
            new("minhanh", Marker, "minhanh_demo", "Nguyễn Minh Anh", "Frontend Developer", "TP. Hồ Chí Minh", "Thích React, cà phê sữa đá và những giao diện gọn gàng."),
            new("quocbao", "quocbao.demo@example.com", "quocbao_demo", "Trần Quốc Bảo", "Backend Developer (.NET)", "Hà Nội", "2 năm làm .NET, đang tìm hiểu thêm về hệ thống phân tán."),
            new("thuha", "thuha.demo@example.com", "thuha_demo", "Lê Thu Hà", "UI/UX Designer", "Đà Nẵng", "Thiết kế sản phẩm số, mê typography và những luồng đăng ký ngắn."),
            new("giahuy", "giahuy.demo@example.com", "giahuy_demo", "Phạm Gia Huy", "Data Analyst", "TP. Hồ Chí Minh", "SQL, Power BI và rất nhiều biểu đồ."),
            new("ngoctram", "ngoctram.demo@example.com", "ngoctram_demo", "Võ Ngọc Trâm", "Chuyên viên Tuyển dụng", "TP. Hồ Chí Minh", "Kết nối ứng viên ngành công nghệ với các nhóm sản phẩm."),
            new("hoangnam", "hoangnam.demo@example.com", "hoangnam_demo", "Đặng Hoàng Nam", "Mobile Developer (Flutter)", "Hà Nội", "Viết app di động, thích chụp ảnh bằng điện thoại."),
        };

        private static readonly Company[] Companies =
        {
            new("fpt", "gioithieu@fptsoftware.example.com", "fptsoftware_demo", "FPT Software", "Công nghệ thông tin", 1999, "Hơn 10.000 nhân viên", "Hà Nội", "https://fptsoftware.com",
                "FPT Software là công ty thành viên của Tập đoàn FPT, cung cấp dịch vụ và giải pháp phần mềm cho khách hàng ở nhiều quốc gia. Công ty có văn phòng tại Hà Nội, TP. Hồ Chí Minh, Đà Nẵng và nhiều nước trên thế giới.", "fpt-cover.jpg"),
            new("vng", "gioithieu@vng.example.com", "vng_demo", "VNG", "Internet & Giải trí số", 2004, "Hơn 1.000 nhân viên", "TP. Hồ Chí Minh", "https://vng.com.vn",
                "VNG là công ty công nghệ Việt Nam thành lập năm 2004, đứng sau những sản phẩm quen thuộc như Zalo, ZaloPay, các trò chơi trực tuyến và dịch vụ điện toán đám mây VNG Cloud.", "vng-cover.jpg"),
            new("momo", "gioithieu@momo.example.com", "momo_demo", "MoMo", "Tài chính & Fintech", 2007, "Hơn 1.000 nhân viên", "TP. Hồ Chí Minh", "https://momo.vn",
                "MoMo là ví điện tử và ứng dụng thanh toán của Công ty Cổ phần Dịch vụ Di động Trực tuyến (M_Service), cho phép chuyển tiền, thanh toán hoá đơn, mua sắm và dùng nhiều dịch vụ tài chính ngay trên điện thoại.", "momo-cover.jpg"),
            new("tiki", "gioithieu@tiki.example.com", "tiki_demo", "Tiki", "Thương mại điện tử", 2010, null, "TP. Hồ Chí Minh", "https://tiki.vn",
                "Tiki là sàn thương mại điện tử Việt Nam ra đời năm 2010, khởi đầu từ bán sách trực tuyến và phát triển thành nền tảng mua sắm đa ngành cùng dịch vụ giao nhanh TikiNOW.", "tiki-cover.jpg"),
            new("viettel", "gioithieu@viettel.example.com", "viettel_demo", "Viettel", "Viễn thông & Công nghệ", 1989, "Hơn 10.000 nhân viên", "Hà Nội", "https://viettel.com.vn",
                "Tập đoàn Công nghiệp – Viễn thông Quân đội (Viettel) thành lập năm 1989, là doanh nghiệp viễn thông lớn tại Việt Nam, có hoạt động đầu tư tại nhiều thị trường nước ngoài cùng các mảng chuyển đổi số, an ninh mạng và công nghiệp công nghệ cao.", "viettel-cover.jpg"),
            new("vinamilk", "gioithieu@vinamilk.example.com", "vinamilk_demo", "Vinamilk", "Thực phẩm & Đồ uống", 1976, "Hơn 5.000 nhân viên", "TP. Hồ Chí Minh", "https://www.vinamilk.com.vn",
                "Công ty Cổ phần Sữa Việt Nam (Vinamilk) thành lập năm 1976, là doanh nghiệp sữa hàng đầu Việt Nam với hệ thống trang trại bò sữa và nhà máy trong nước; sản phẩm có mặt tại nhiều quốc gia.", "vinamilk-cover.jpg"),
        };

        private record SeedPost(string Author, double HoursAgo, string? Title, string Content, string[] Media, string[] Likers, (string Who, string Text, double HoursAgo)[] Comments);

        private static readonly SeedPost[] Posts =
        {
            new("fpt", 5, "Giới thiệu nhanh về FPT Software",
                "FPT Software thành lập năm 1999, là công ty thành viên của Tập đoàn FPT. Đội ngũ kỹ sư làm việc với khách hàng ở nhiều quốc gia trong các mảng chuyển đổi số, điện toán đám mây, AI và phần mềm nhúng.\n\nBạn muốn biết thêm về công việc ở mảng nào? Hỏi ngay dưới bình luận nhé. #FPTSoftware #CongNghe",
                new[] { "v-fpt.mp4", "fpt-setup.jpg" }, new[] { "minhanh", "quocbao", "giahuy", "hoangnam", "owner" },
                new[] { ("quocbao", "Chương trình fresher bên mình có yêu cầu tiếng Nhật không ạ?", 4.0), ("minhanh", "Góc nhìn ra thành phố từ văn phòng đẹp thật 😍", 3.2) }),
            new("vng", 9, "VNG — từ Zalo đến VNG Cloud",
                "Thành lập năm 2004, VNG là công ty đứng sau Zalo, ZaloPay, nhiều trò chơi trực tuyến và dịch vụ đám mây VNG Cloud. Trụ sở chính VNG Campus đặt tại Quận 7, TP. Hồ Chí Minh. #VNG #Zalo",
                new[] { "v-vng.mp4" }, new[] { "thuha", "giahuy", "minhanh", "ngoctram" },
                new[] { ("thuha", "Zalo là app mình mở nhiều nhất mỗi ngày luôn 😄", 8.0), ("giahuy", "VNG Cloud có tuyển data engineer không nhỉ?", 6.5) }),
            new("momo", 20, null,
                "MoMo bắt đầu từ năm 2007 và hiện là một trong những ví điện tử phổ biến tại Việt Nam: chuyển tiền, thanh toán hoá đơn, mua sắm và nhiều dịch vụ tài chính ngay trên điện thoại. #MoMo #Fintech",
                new[] { "v-momo.mp4" }, new[] { "ngoctram", "giahuy" },
                new[] { ("ngoctram", "Giờ đi chợ cũng quét mã được rồi, tiện ghê.", 18.0) }),
            new("vinamilk", 27, "Từ trang trại đến hộp sữa",
                "Vinamilk thành lập năm 1976, là doanh nghiệp sữa hàng đầu Việt Nam với hệ thống trang trại bò sữa và nhà máy ở nhiều tỉnh thành. Một vòng từ đồng cỏ đến dây chuyền đóng gói trong video này. #Vinamilk",
                new[] { "v-vinamilk.mp4", "vinamilk-cows.jpg", "vinamilk-plant.jpg" }, new[] { "hoangnam", "ngoctram", "thuha" },
                new[] { ("hoangnam", "Nhìn đàn bò mà thấy yên bình quá.", 25.0) }),
            new("tiki", 34, null,
                "Tiki ra đời năm 2010, khởi đầu từ bán sách trực tuyến và dần trở thành sàn thương mại điện tử đa ngành với dịch vụ giao nhanh TikiNOW. Mỗi đơn hàng là một hành trình qua thành phố 🛵 #Tiki #ThuongMaiDienTu",
                new[] { "v-tiki.mp4", "tiki-mall.jpg" }, new[] { "thuha", "minhanh" },
                Array.Empty<(string, string, double)>()),
            new("viettel", 46, "Viettel — hạ tầng kết nối",
                "Viettel thành lập năm 1989, là tập đoàn viễn thông và công nghệ lớn tại Việt Nam, có hoạt động ở nhiều thị trường nước ngoài. Ngoài viễn thông, Viettel còn phát triển các mảng chuyển đổi số, an ninh mạng và công nghiệp công nghệ cao. #Viettel #VienThong",
                new[] { "v-viettel.mp4", "viettel-tower.jpg" }, new[] { "quocbao", "hoangnam" },
                new[] { ("quocbao", "Mảng an ninh mạng bên này nghe hấp dẫn thật.", 40.0) }),
            new("fpt", 60, null,
                "Một ngày ở văn phòng: bàn làm việc buổi sáng, cuộc họp đầu tuần và góc nhìn ra thành phố. #MotNgayOCongTy",
                new[] { "fpt-desk.jpg", "fpt-city.jpg", "fpt-team.jpg" }, new[] { "minhanh", "giahuy" },
                Array.Empty<(string, string, double)>()),
            new("vng", 75, null,
                "Góc cà phê buổi chiều và những bàn phím cơ quen thuộc của team kỹ thuật ☕ #MotNgayOCongTy",
                new[] { "vng-cafe.jpg", "vng-keyboard.jpg", "vng-people.jpg" }, new[] { "thuha", "hoangnam", "quocbao" },
                Array.Empty<(string, string, double)>()),

            new("minhanh", 2, null,
                "Vừa hoàn thành dự án đầu tiên bằng Next.js ở công ty mới. Cảm ơn team đã kiên nhẫn review từng dòng code 🙏 #frontend #nextjs",
                new[] { "u-macbook.jpg" }, new[] { "quocbao", "thuha", "owner" },
                new[] { ("quocbao", "Chúc mừng nha! Lần sau chia sẻ cách setup dự án với 😄", 1.5) }),
            new("quocbao", 12, "3 điều mình học được sau 2 năm làm .NET",
                "1. Viết test trước khi tối ưu.\n2. Đọc log kỹ trước khi tra Google.\n3. Một API tốt là API mà người dùng không cần hỏi lại.\n\nCòn bạn, bài học lớn nhất trong công việc của bạn là gì? #dotnet #backend",
                Array.Empty<string>(), new[] { "minhanh", "ngoctram", "giahuy" },
                new[] { ("minhanh", "Điều số 2 chuẩn luôn 😂", 11.0), ("ngoctram", "Lưu lại để gửi cho mấy bạn thực tập.", 10.0) }),
            new("thuha", 16, null,
                "Cuối tuần ngồi cà phê vẽ lại luồng đăng ký cho app. Ai có góp ý về trải nghiệm form thì cho mình xin nhé ✏️ #uxdesign",
                new[] { "u-cafe.jpg", "u-books.jpg" }, new[] { "minhanh", "hoangnam" },
                new[] { ("minhanh", "Gửi mình bản Figma với, mình góp ý phần kiểm tra lỗi form nhé!", 15.0) }),
            new("ngoctram", 30, null,
                "Mẹo nhỏ cho bạn nào đang viết CV: đưa kết quả cụ thể lên đầu mỗi kinh nghiệm (tăng bao nhiêu %, tiết kiệm bao nhiêu giờ). Nhà tuyển dụng thường chỉ lướt khoảng 30 giây cho một CV. #tuyendung #CV",
                Array.Empty<string>(), new[] { "giahuy", "quocbao", "thuha", "owner" },
                new[] { ("giahuy", "Hữu ích quá, mình sửa CV ngay tối nay.", 28.0) }),
            new("giahuy", 40, null,
                "Buổi team outing cuối tuần ở công viên. Lâu lắm mới rời màn hình dashboard 😄",
                new[] { "v-sample.mp4" }, new[] { "ngoctram", "minhanh" },
                Array.Empty<(string, string, double)>()),
            new("hoangnam", 52, null,
                "Thử quay chậm bằng điện thoại mới — rõ đến từng cánh hoa 🌷",
                new[] { "v-flower.mp4" }, new[] { "thuha" },
                Array.Empty<(string, string, double)>()),
        };

        public static async Task SeedAsync(ArisDBContext db, ILogger logger)
        {
            try
            {
                var now = DateTime.UtcNow;
                var owner = await EnsureOwnerAsync(db);
                var firstRun = !await db.Users.AnyAsync(u => u.Email == Marker);

                if (firstRun)
                {
                    await using var tx = await db.Database.BeginTransactionAsync();
                    var users = new Dictionary<string, User> { ["owner"] = owner };

                    foreach (var p in People)
                    {
                        var u = new User
                        {
                            Email = p.Email,
                            Username = await UniqueUsernameAsync(db, p.Username),
                            Role = "Employee",
                            ShowActiveStatus = true,
                            Profile = new EmployesAccount
                            {
                                FullName = p.FullName,
                                JobTitle = p.JobTitle,
                                Location = p.Location,
                                Bio = p.Bio,
                                AvatarUrl = "/images/default-avatar.png",
                                IsLookingForJob = p.Key != "ngoctram"
                            }
                        };
                        db.Users.Add(u);
                        users[p.Key] = u;
                    }

                    var companies = new Dictionary<string, BussinessAccount>();
                    foreach (var c in Companies)
                    {
                        var u = new User { Email = c.Email, Username = await UniqueUsernameAsync(db, c.Username), Role = "Business", ShowActiveStatus = true };
                        var biz = new BussinessAccount
                        {
                            FullName = c.Name + " · Tuyển dụng",
                            JobTitle = "Nhà tuyển dụng",
                            Location = c.City,
                            Bio = c.Description,
                            AvatarUrl = "/images/default-avatar.png",
                            CoverPhotoUrl = Media + c.Cover,
                            IsLookingForJob = false,
                            CompanyName = c.Name,
                            CompanyAddress = c.City,
                            Industry = c.Industry,
                            Description = c.Description + SampleNote,
                            WebsiteUrl = c.Website,
                            CompanySize = c.Size,
                            FoundedYear = c.Founded,
                            IsVerified = false,
                            User = u
                        };
                        db.BussinessAccounts.Add(biz);
                        users[c.Key] = u;
                        companies[c.Key] = biz;
                    }
                    await db.SaveChangesAsync();

                    // ---- Bài đăng + ảnh/video + thích + bình luận ----
                    var hasMediaOrder = await TableUsableAsync(() => db.PostMediaOrders.AnyAsync());
                    foreach (var sp in Posts)
                    {
                        var created = now.AddHours(-sp.HoursAgo);
                        var post = new Post
                        {
                            Title = sp.Title,
                            Content = sp.Content,
                            IsPublic = true,
                            CreatedAt = created,
                            UpdatedAt = created,
                            UserId = users[sp.Author].Id,
                            LikeCount = sp.Likers.Length,
                            CommentCount = sp.Comments.Length,
                            PostMedias = sp.Media.Select(m => new PostMedias
                            {
                                MediaUrl = Media + m,
                                MediaType = m.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) ? "video" : "image"
                            }).ToList()
                        };
                        db.Posts.Add(post);
                        await db.SaveChangesAsync();

                        if (hasMediaOrder)
                        {
                            var i = 0;
                            foreach (var m in post.PostMedias) db.PostMediaOrders.Add(new PostMediaOrder { PostMediaId = m.Id, SortOrder = i++ });
                        }
                        var k = 0;
                        foreach (var who in sp.Likers)
                            db.Likes.Add(new Like { UserId = users[who].Id, PostId = post.Id, CreatedAt = created.AddMinutes(20 + 17 * k++) });
                        foreach (var (who, text, hoursAgo) in sp.Comments)
                            db.Comments.Add(new Comment { UserId = users[who].Id, PostId = post.Id, Content = text, CreatedAt = now.AddHours(-hoursAgo) });
                    }
                    await db.SaveChangesAsync();

                    // ---- Bạn bè: 4 bạn đã kết nối, 2 lời mời đang chờ, vài cặp bạn chung ----
                    void Friend(string a, string b, string status, double daysAgo)
                    {
                        db.Friendships.Add(new Friendship
                        {
                            RequesterId = users[a].Id,
                            AddresseeId = users[b].Id,
                            Status = status,
                            CreatedAt = now.AddDays(-daysAgo),
                            RespondedAt = status == FriendshipStatus.Accepted ? now.AddDays(-daysAgo).AddHours(3) : null
                        });
                    }
                    Friend("minhanh", "owner", FriendshipStatus.Accepted, 20);
                    Friend("owner", "quocbao", FriendshipStatus.Accepted, 15);
                    Friend("owner", "thuha", FriendshipStatus.Accepted, 6);
                    Friend("ngoctram", "owner", FriendshipStatus.Accepted, 9);
                    Friend("giahuy", "owner", FriendshipStatus.Pending, 1);
                    Friend("hoangnam", "owner", FriendshipStatus.Pending, 0.2);
                    Friend("minhanh", "quocbao", FriendshipStatus.Accepted, 40);
                    Friend("minhanh", "thuha", FriendshipStatus.Accepted, 35);
                    Friend("quocbao", "giahuy", FriendshipStatus.Accepted, 30);
                    Friend("thuha", "hoangnam", FriendshipStatus.Accepted, 25);
                    Friend("ngoctram", "giahuy", FriendshipStatus.Accepted, 22);
                    Friend("minhanh", "hoangnam", FriendshipStatus.Accepted, 18);

                    // ---- Tin nhắn mẫu với chủ dự án ----
                    var tech = await db.Users.FirstOrDefaultAsync(u => u.Email == "hr@technova.example.com");
                    if (tech != null) users["technova"] = tech;
                    void Chat(string from, string to, string text, double hoursAgo, bool read = true)
                    {
                        if (!users.ContainsKey(from) || !users.ContainsKey(to)) return;
                        db.Messages.Add(new Message { SenderId = users[from].Id, ReceiverId = users[to].Id, Content = text, SentAt = now.AddHours(-hoursAgo), IsRead = read });
                    }
                    Chat("ngoctram", "owner", "Chào bạn, mình là Trâm bên tuyển dụng. Mình thấy hồ sơ của bạn khá hợp với vị trí thực tập Frontend.", 98);
                    Chat("owner", "ngoctram", "Dạ em chào chị, em rất quan tâm ạ.", 97.5);
                    Chat("ngoctram", "owner", "Tuần sau mình hẹn phỏng vấn online 30 phút nhé, bạn rảnh chiều thứ Ba không?", 97);
                    Chat("owner", "ngoctram", "Dạ chiều thứ Ba em rảnh ạ.", 96.8);
                    Chat("ngoctram", "owner", "Tuyệt, mình sẽ gửi lịch qua Aris 👍", 96.5);
                    Chat("minhanh", "owner", "Ê, tuần sau bên mình mở thêm 2 vị trí frontend, bạn có muốn mình giới thiệu không?", 50);
                    Chat("owner", "minhanh", "Có chứ! Yêu cầu kinh nghiệm bao lâu vậy?", 49.6);
                    Chat("minhanh", "owner", "Tầm 1 năm React là ổn. Gửi mình CV bản mới nhất nhé.", 49.4);
                    Chat("owner", "minhanh", "Ok để tối nay mình cập nhật rồi gửi.", 49);
                    Chat("minhanh", "owner", "Nhớ gửi CV nha 😄", 2, read: false);
                    Chat("quocbao", "owner", "Bài viết về .NET của mình có chỗ nào khó hiểu không?", 26);
                    Chat("owner", "quocbao", "Dễ hiểu mà, mình thích nhất điều số 3.", 25.5);
                    Chat("quocbao", "owner", "Cảm ơn nha! Cuối tuần cà phê không?", 25);
                    Chat("thuha", "owner", "Bạn thử giúp mình luồng đăng ký mới với, mình gửi link Figma nè.", 3.2, read: false);
                    Chat("thuha", "owner", "Chủ yếu xem phần chọn vai trò có rõ không.", 3.1, read: false);
                    Chat("technova", "owner", "Chào bạn, cảm ơn bạn đã quan tâm đến TechNova Solutions. Vị trí Frontend Developer (ReactJS) vẫn đang mở, bạn có thể ứng tuyển trực tiếp trên Aris.", 20, read: false);

                    // ---- Thông báo ----
                    db.Notifications.Add(new Notification { UserId = owner.Id, ActorId = users["hoangnam"].Id, Type = "FriendRequest", Content = "đã gửi cho bạn một lời mời kết bạn.", Link = "/Chat/Index?networkTab=requests", CreatedAt = now.AddHours(-5) });
                    db.Notifications.Add(new Notification { UserId = owner.Id, ActorId = users["giahuy"].Id, Type = "FriendRequest", Content = "đã gửi cho bạn một lời mời kết bạn.", Link = "/Chat/Index?networkTab=requests", CreatedAt = now.AddDays(-1) });
                    db.Notifications.Add(new Notification { UserId = owner.Id, ActorId = users["thuha"].Id, Type = "FriendRequestAccepted", Content = "đã chấp nhận lời mời kết bạn của bạn.", Link = "/Chat/Index?networkTab=friends", CreatedAt = now.AddDays(-6), IsRead = true });
                    await db.SaveChangesAsync();

                    // ---- Theo dõi công ty (bảng V7 — bỏ qua nếu chưa có) ----
                    if (await TableUsableAsync(() => db.CompanyFollows.AnyAsync()))
                    {
                        void Follow(string who, string co) => db.CompanyFollows.Add(new CompanyFollow { UserId = users[who].Id, BusinessAccountId = companies[co].Id, CreatedAt = now.AddDays(-3) });
                        Follow("owner", "fpt"); Follow("owner", "vng");
                        Follow("minhanh", "fpt"); Follow("quocbao", "fpt"); Follow("giahuy", "fpt");
                        Follow("minhanh", "vng"); Follow("thuha", "vng"); Follow("hoangnam", "vng");
                        Follow("giahuy", "momo"); Follow("ngoctram", "momo");
                        Follow("thuha", "tiki");
                        Follow("quocbao", "viettel"); Follow("hoangnam", "viettel");
                        Follow("ngoctram", "vinamilk");
                        await db.SaveChangesAsync();
                    }

                    await tx.CommitAsync();
                    logger.LogInformation("DemoSocialSeeder: đã tạo dữ liệu mẫu (người dùng, công ty, bài đăng, tin nhắn).");
                }

                await EnsureMediaMessagesAsync(db, now);
                await RefreshStoriesAsync(db, now, logger);
            }
            catch (Exception ex)
            {
                // Dữ liệu mẫu không được làm hỏng việc khởi động app
                logger.LogWarning(ex, "DemoSocialSeeder: bỏ qua do lỗi.");
            }
        }

        /// <summary>Tin nhắn có ảnh / video mẫu (bổ sung một lần, kể cả khi phần dữ liệu chính đã tạo từ trước).</summary>
        private static async Task EnsureMediaMessagesAsync(ArisDBContext db, DateTime now)
        {
            if (await db.Messages.AnyAsync(m => m.ImageUrl != null && m.ImageUrl.StartsWith(Media))) return;
            var owner = await db.Users.FirstOrDefaultAsync(u => u.Email == OwnerEmail);
            var ha = await db.Users.FirstOrDefaultAsync(u => u.Email == "thuha.demo@example.com");
            var anh = await db.Users.FirstOrDefaultAsync(u => u.Email == Marker);
            if (owner == null || ha == null || anh == null) return;
            db.Messages.Add(new Message { SenderId = ha.Id, ReceiverId = owner.Id, Content = "Bản phác thảo mới nè, xem thử nha 👀", ImageUrl = Media + "u-books.jpg", SentAt = now.AddHours(-3), IsRead = false });
            db.Messages.Add(new Message { SenderId = anh.Id, ReceiverId = owner.Id, Content = "Video văn phòng mới bên mình nè 😄", ImageUrl = Media + "v-fpt.mp4", SentAt = now.AddMinutes(-95), IsRead = true });
            db.Messages.Add(new Message { SenderId = owner.Id, ReceiverId = anh.Id, Content = "Đẹp quá! Có góc cà phê không? ☕", SentAt = now.AddMinutes(-88), IsRead = true });
            db.Messages.Add(new Message { SenderId = owner.Id, ReceiverId = anh.Id, Content = "Tối nay mình gửi CV cho bạn nhé", SentAt = now.AddMinutes(-87), IsRead = true });
            db.Messages.Add(new Message { SenderId = anh.Id, ReceiverId = owner.Id, Content = "Có luôn, tầng 5 nhìn ra thành phố đẹp lắm", SentAt = now.AddMinutes(-80), IsRead = false });
            await db.SaveChangesAsync();
        }

        /// <summary>Tin 24h mẫu: tạo lại mỗi lần khởi động nếu các tin mẫu cũ đã hết hạn.</summary>
        private static async Task RefreshStoriesAsync(ArisDBContext db, DateTime now, ILogger logger)
        {
            if (!await TableUsableAsync(() => db.Stories.AnyAsync())) return;
            var demoUsers = await db.Users
                .Where(u => u.Email.EndsWith(".demo@example.com") || u.Email.StartsWith("gioithieu@"))
                .Select(u => new { u.Id, u.Email })
                .ToListAsync();
            if (demoUsers.Count == 0) return;
            var ids = demoUsers.Select(u => u.Id).ToList();
            if (await db.Stories.AnyAsync(s => ids.Contains(s.UserId) && s.ExpiresAt > now)) return;

            int? Id(string email) => demoUsers.FirstOrDefault(u => u.Email == email)?.Id;
            var bizIds = await db.BussinessAccounts.Where(b => ids.Contains(b.UserId)).ToDictionaryAsync(b => b.UserId, b => b.Id);
            void Add(string email, string file, string? caption, double hoursAgo, bool companyLink)
            {
                var uid = Id(email);
                if (uid == null) return;
                var created = now.AddHours(-hoursAgo);
                db.Stories.Add(new Story
                {
                    UserId = uid.Value,
                    MediaUrl = Media + file,
                    MediaType = file.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) ? "video" : "image",
                    Caption = caption,
                    LinkUrl = companyLink && bizIds.TryGetValue(uid.Value, out var bid) ? $"/Company/Details/{bid}" : null,
                    LinkLabel = companyLink ? "Xem trang công ty" : null,
                    CreatedAt = created,
                    ExpiresAt = created.AddHours(24)
                });
            }
            Add("gioithieu@fptsoftware.example.com", "fpt-city.jpg", "Góc nhìn từ văn phòng sáng nay", 1.5, true);
            Add("gioithieu@vng.example.com", "v-vng.mp4", "Chiều thứ Sáu ở văn phòng", 3, true);
            Add("gioithieu@vinamilk.example.com", "vinamilk-cow.jpg", "Một buổi sáng ở trang trại", 5, true);
            Add("gioithieu@momo.example.com", "momo-phone.jpg", "Quét mã, xong!", 7, true);
            Add(Marker, "u-coffee.jpg", "Cà phê trước giờ code ☕", 2, false);
            Add("thuha.demo@example.com", "u-sunset.jpg", "Hoàng hôn Đà Nẵng", 6, false);
            Add("giahuy.demo@example.com", "u-street.jpg", "Đi bộ về nhà", 9, false);
            await db.SaveChangesAsync();
            logger.LogInformation("DemoSocialSeeder: đã làm mới tin 24h mẫu.");
        }

        private static async Task<User> EnsureOwnerAsync(ArisDBContext db)
        {
            var owner = await db.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Email == OwnerEmail);
            if (owner != null) return owner;
            owner = new User
            {
                Email = OwnerEmail,
                Username = await UniqueUsernameAsync(db, "tohkadangyeu"),
                Role = "Employee",
                ShowActiveStatus = true,
                Profile = new EmployesAccount
                {
                    FullName = "tohkadangyeu",
                    AvatarUrl = "/images/default-avatar.png",
                    Location = "Chưa cập nhật",
                    JobTitle = "Ứng viên tiềm năng"
                }
            };
            db.Users.Add(owner);
            await db.SaveChangesAsync();
            return owner;
        }

        private static async Task<string> UniqueUsernameAsync(ArisDBContext db, string baseName)
        {
            var name = baseName;
            var i = 1;
            while (await db.Users.AnyAsync(u => u.Username == name) || db.Users.Local.Any(u => u.Username == name))
                name = $"{baseName}{i++}";
            return name;
        }

        /// <summary>Bảng tuỳ chọn (migration V7) có dùng được không — chưa áp migration thì truy vấn ném lỗi.</summary>
        private static async Task<bool> TableUsableAsync(Func<Task<bool>> probe)
        {
            try { await probe(); return true; }
            catch { return false; }
        }
    }
}
