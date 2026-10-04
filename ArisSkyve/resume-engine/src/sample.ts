import type { CanonicalResume } from './schema';

export const sample: CanonicalResume = {
  meta: { slug: 'nguyen-an', version: '1.0.0', theme: { primaryColor: '#172c3d', accentColor: '#b5efce', fontHeading: 'auto', fontBody: 'auto', radius: 'md' }, atsOptimized: true },
  basics: { name: 'Nguyễn An', headline: 'Senior Software Engineer · Product-minded builder', email: 'an@example.com', phone: '+84 900 000 000', location: { city: 'Hồ Chí Minh', country: 'Việt Nam', remoteStatus: 'hybrid' }, summary: 'Tôi thiết kế sản phẩm web nhanh, dễ dùng và vận hành ổn định. Tập trung vào kiến trúc frontend, trải nghiệm người dùng và hiệu quả của nhóm.', links: [{ platform: 'github', label: 'GitHub', url: 'https://github.com/' }, { platform: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/' }] },
  work: [
    { id: 'w1', company: 'Northstar Labs', role: 'Senior Software Engineer', startDate: '2022-03', endDate: null, isCurrent: true, highlights: ['Dẫn dắt tái cấu trúc nền tảng thiết kế dùng chung cho 6 nhóm sản phẩm.', 'Cải thiện thời gian tải trang 35% qua chia nhỏ bundle và cache dữ liệu.'], metrics: [{ label: 'Tốc độ tải', value: '−35%' }, { label: 'Nhóm sử dụng', value: '6' }], techStack: ['React', 'TypeScript', 'Node.js'] },
    { id: 'w2', company: 'Monsoon Digital', role: 'Frontend Engineer', startDate: '2019-06', endDate: '2022-02', isCurrent: false, highlights: ['Xây dựng hệ thống dashboard và quy trình phát hành cho đội sản phẩm B2B.', 'Phối hợp cùng thiết kế và dữ liệu để cải thiện trải nghiệm quản trị.'], techStack: ['React', 'GraphQL', 'Figma'] },
  ],
  projects: [
    { id: 'p1', title: 'Orbit Analytics', tagline: 'Biến dữ liệu vận hành thành quyết định', description: 'Dashboard phân tích sản phẩm với các báo cáo thời gian thực và luồng khám phá linh hoạt.', featured: true, stack: ['React', 'TypeScript', 'GraphQL'], liveUrl: 'https://example.com' },
    { id: 'p2', title: 'Atlas UI', tagline: 'Hệ thống thiết kế đa thương hiệu', description: 'Thư viện thành phần thống nhất trải nghiệm trên web và ứng dụng nội bộ.', featured: false, stack: ['React', 'Figma'] },
  ],
  skills: [{ category: 'Frontend', items: [{ name: 'React', level: 'expert' }, { name: 'TypeScript', level: 'expert' }, { name: 'CSS', level: 'expert' }] }, { category: 'Product & Systems', items: [{ name: 'GraphQL' }, { name: 'Figma' }, { name: 'Node.js' }] }],
  education: [{ institution: 'Đại học Bách Khoa', degree: 'Cử nhân', field: 'Khoa học máy tính', startDate: '2015-09', endDate: '2019-06' }],
};
