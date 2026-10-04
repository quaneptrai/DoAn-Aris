import os
import sys
import uuid
import datetime
import requests
import pyodbc

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

print("=== 1. Downloading and Saving Media to Google Drive Storage ===")
image_urls = [
    # 1. Astra 6
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80",
    # 2. AI Models Comparison
    "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&auto=format&fit=crop&q=80",
    # 3. TechNova Hiring AI Engineer
    "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80",
    # 4. Developer Skills & Team
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80",
]

saved_media_urls = []
storage_dir = r"G:\My Drive\ArisStorage\image-folder"
os.makedirs(storage_dir, exist_ok=True)

for i, u in enumerate(image_urls):
    resp = requests.get(u, timeout=15)
    file_id = f"{uuid.uuid4()}.jpg"
    file_path = os.path.join(storage_dir, file_id)
    with open(file_path, "wb") as f:
        f.write(resp.content)
    media_url = f"http://localhost:8001/storage/image-folder/{file_id}"
    saved_media_urls.append(media_url)
    print(f"  [Saved {i+1}] {file_path} -> {media_url}")

print("\n=== 2. Connecting to Database & Seeding Posts ===")
conn_str = "DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost\\SQLEXPRESS;DATABASE=ArisSkyve_Dev;Trusted_Connection=yes;TrustServerCertificate=yes;"
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

# Check Users
cursor.execute("SELECT Id, Username FROM Users")
users = dict(cursor.fetchall())
print("Available Users:", users)

user_quan = 4 if 4 in users else list(users.keys())[0]
user_hr = 1 if 1 in users else list(users.keys())[0]
user_candidate = 5 if 5 in users else (3 if 3 in users else list(users.keys())[0])

now = datetime.datetime.utcnow()

posts_data = [
    {
        "title": "Chính thức ra mắt Astra 6: Kỷ nguyên mới của Trí tuệ Nhân tạo Đa phương thức",
        "content": "Hôm nay chúng tôi vô cùng hào hứng chia sẻ thông tin về sự xuất hiện của Astra 6 — thế hệ mô hình AI đa phương thức tiên tiến bậc nhất. Với khả năng xử lý ngữ cảnh lên tới 10M tokens, cơ chế suy luận chuyên sâu (Deep Reasoning) và tối ưu hóa xử lý song song, Astra 6 mở ra tiềm năng cách mạng cho phân tích dữ liệu ứng viên, khớp nối JD tự động và gợi ý lộ trình thăng tiến sự nghiệp thời gian thực.",
        "userId": user_quan,
        "media": saved_media_urls[0],
        "likes": 28,
        "comments": 6,
        "mins_ago": 25,
    },
    {
        "title": "Bản đồ các dòng Frontier AI Models 2026: Gemini 2.5, Claude 3.7, DeepSeek R1 & Llama 3.3",
        "content": "Một góc nhìn tổng hợp dành cho các kỹ sư công nghệ và nhà phát triển:\n\n1. Astra 6 / Gemini 2.5 Flash: Tối ưu hoá suy luận thời gian thực với độ trễ cực thấp và chi phí vận hành lý tưởng.\n2. Claude 3.7 Sonnet: Chuẩn mực trong lập trình phức tạp, refactoring kiến trúc lớn và sinh test case tự động.\n3. DeepSeek R1: Kiến trúc suy luận mở với chuỗi tư duy CoT minh bạch, giải quyết bài toán thuật toán hóc búa.\n4. Llama 3.3 70B: Nền tảng mã nguồn mở mạnh mẽ, phù hợp triển khai private cloud cho doanh nghiệp.\n\nBạn đang ứng dụng mô hình nào trong sản phẩm của mình?",
        "userId": user_quan,
        "media": saved_media_urls[1],
        "likes": 19,
        "comments": 4,
        "mins_ago": 85,
    },
    {
        "title": "TechNova Solutions tuyển dụng: Senior AI Platform & Optimization Engineer (Thu nhập 45 - 65M)",
        "content": "Đón đầu làn sóng tích hợp Astra 6 và các mô hình suy luận đa phương thức thế hệ mới, TechNova Solutions mở rộng đội ngũ AI Core tại TP. Hồ Chí Minh:\n\n✨ Vị trí: Senior AI Platform Engineer\n💼 Mức thu nhập: 45.000.000 - 65.000.000 VNĐ + Thưởng hiệu suất & ESOP\n📍 Địa điểm: Tòa nhà Innovation, 123 Nguyễn Huệ, Quận 1 (Chế độ Hybrid linh hoạt)\n🎯 Yêu cầu: Kinh nghiệm tối ưu hóa suy luận LLM (vLLM, TensorRT-LLM), xây dựng pipeline Retrieval-Augmented Generation (RAG) và quản trị hạ tầng Vector Store Pinecone/Milvus.\n\nỨng tuyển trực tiếp trên hệ thống Aris Career ngay hôm nay!",
        "userId": user_hr,
        "media": saved_media_urls[2],
        "likes": 35,
        "comments": 9,
        "mins_ago": 180,
    },
    {
        "title": "5 Năng lực cốt lõi kỹ sư công nghệ cần trang bị trong kỷ nguyên AI Agents",
        "content": "AI không thay thế lập trình viên, nhưng lập trình viên biết làm chủ AI sẽ vượt lên dẫn đầu. 5 kỹ năng quan trọng nhất hiện nay:\n\n• Kiến trúc hệ thống phân tán & API Gateway chịu tải lớn\n• Kỹ nghệ điều hướng ngữ cảnh (Context Engineering) & Agentic Workflows\n• Hệ cơ sở dữ liệu Vector và tìm kiếm kết hợp (Hybrid Search)\n• Quản lý chất lượng & bảo mật mã nguồn do AI hỗ trợ sinh ra\n• Kỹ năng giao tiếp và biến bài toán thực tế thành giải pháp công nghệ",
        "userId": user_candidate,
        "media": saved_media_urls[3],
        "likes": 14,
        "comments": 3,
        "mins_ago": 320,
    },
]

for p in posts_data:
    created_at = now - datetime.timedelta(minutes=p["mins_ago"])
    cursor.execute(
        """
        INSERT INTO Posts (Title, Content, UserId, CreatedAt, UpdatedAt, IsPublic, LikeCount, CommentCount)
        OUTPUT INSERTED.Id
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    """,
        p["title"],
        p["content"],
        p["userId"],
        created_at,
        created_at,
        p["likes"],
        p["comments"],
    )
    post_id = cursor.fetchone()[0]
    cursor.execute(
        """
        INSERT INTO PostMedias (PostId, MediaUrl, MediaType)
        VALUES (?, ?, 'image')
    """,
        post_id,
        p["media"],
    )
    print(f"  [Inserted Post] Id={post_id}: {p['title'][:50]}...")

print("\n=== 3. Seeding New High-Tech Job Postings ===")
new_jobs = [
    {
        "title": "Senior AI Platform Engineer (Astra 6 & LLMs)",
        "company": "TechNova Solutions",
        "category": "Trí tuệ nhân tạo",
        "salary": "45 - 65 triệu",
        "experience": "3 - 5 năm",
        "workTime": "Toàn thời gian",
        "businessAccountId": 1,
        "responsibilities": '["Xây dựng hạ tầng suy luận LLMs với vLLM, TensorRT-LLM", "Tích hợp mô hình Astra 6 và các frontier models vào nền tảng tuyển dụng thông minh", "Tối ưu hóa độ trễ và chi phí GPU clusters"]',
        "requirements": '["3+ năm kinh nghiệm phát triển AI/ML pipelines bằng Python, PyTorch", "Kinh nghiệm thực chiến với RAG, Vector Search (Pinecone/Milvus)", "Tư duy tối ưu hóa hiệu năng hệ thống cao"]',
        "benefits": '["Lương thưởng cạnh tranh 45 - 65 triệu + ESOP", "Gói bảo hiểm sức khỏe quốc tế cao cấp", "MacBook Pro M3 Max được cấp mới", "Làm việc Hybrid 2 ngày/tuần"]',
        "locationTags": '["Quận 1, TP. Hồ Chí Minh", "Hybrid"]',
        "hashtags": '["#AI", "#Astra6", "#MachineLearning", "#TechNova"]',
        "fullText": "TechNova Solutions tìm kiếm Senior AI Platform Engineer đồng hành cùng dự án tích hợp Astra 6 thế hệ mới.",
        "screeningQuestions": '["Bạn đã có kinh nghiệm tối ưu hóa suy luận LLM bằng công cụ nào?", "Kinh nghiệm xây dựng hệ thống RAG quy mô lớn của bạn là gì?"]',
    },
    {
        "title": "Cloud DevOps & Infrastructure Architect",
        "company": "TechNova Solutions",
        "category": "Công nghệ thông tin",
        "salary": "35 - 50 triệu",
        "experience": "3+ năm",
        "workTime": "Toàn thời gian",
        "businessAccountId": 1,
        "responsibilities": '["Thiết kế và quản trị kiến trúc Kubernetes trên AWS/GCP", "Xây dựng quy trình CI/CD tự động hoá với GitHub Actions và ArgoCD", "Đảm bảo an toàn thông tin và tính sẵn sàng cao 99.99%"]',
        "requirements": '["Thành thạo Kubernetes, Terraform, Docker, Helm", "Kinh nghiệm quản trị hạ tầng chịu tải lớn", "Chứng chỉ AWS Solutions Architect hoặc CKA là lợi thế"]',
        "benefits": '["Mức thu nhập 35 - 50 triệu thưởng tháng 13, 14", "Xét tăng lương 2 lần/năm", "Thẻ tập Gym/Yoga cao cấp", "Môi trường văn hóa mở và công nghệ tiên tiến"]',
        "locationTags": '["Quận 1, TP. Hồ Chí Minh"]',
        "hashtags": '["#DevOps", "#Kubernetes", "#Cloud", "#AWS"]',
        "fullText": "Vị trí Cloud DevOps & Infrastructure Architect tại TechNova Solutions chịu trách nhiệm vận hành hạ tầng đám mây toàn cầu.",
        "screeningQuestions": '["Kinh nghiệm quản trị cụm Kubernetes lớn nhất của bạn là bao nhiêu nodes?", "Bạn đã từng xử lý sự cố hạ tầng khẩn cấp nào đáng nhớ?"]',
    },
]

for j in new_jobs:
    deadline = now + datetime.timedelta(days=30)
    cursor.execute(
        """
        INSERT INTO JobPostings (Title, Company, Category, Salary, Experience, WorkTime, BusinessAccountId, 
                                 Responsibilities, Requirements, Benefits, LocationTags, Hashtags, FullText, 
                                 ScreeningQuestions, CreatedAt, UpdatedAt, Deadline, OriginalUrl)
        OUTPUT INSERTED.Id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')
    """,
        j["title"],
        j["company"],
        j["category"],
        j["salary"],
        j["experience"],
        j["workTime"],
        j["businessAccountId"],
        j["responsibilities"],
        j["requirements"],
        j["benefits"],
        j["locationTags"],
        j["hashtags"],
        j["fullText"],
        j["screeningQuestions"],
        now,
        now,
        deadline,
    )
    job_id = cursor.fetchone()[0]
    cursor.execute(
        """
        INSERT INTO JobLocations (City, Address, JobPostingId)
        VALUES ('TP. Hồ Chí Minh', '123 Nguyễn Huệ, Quận 1', ?)
    """,
        job_id,
    )
    print(f"  [Inserted Job] Id={job_id}: {j['title']} ({j['salary']})")

conn.commit()
conn.close()
print("\n=== SEEDING COMPLETED SUCCESSFULLY! ===")
