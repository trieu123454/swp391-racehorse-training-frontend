"use client";
import { Routes } from "@/routes/Routes";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Pause,
  Play,
  Stethoscope,
  Wallet,
  Warehouse,
} from "lucide-react";
import { routeForRole } from "@/lib/roles";
import { getUser } from "@/lib/session";
import type { AuthUser } from "@/lib/types";
import { SiteFooter } from "@/components/shared/SiteFooter";
import { SiteHeader } from "@/components/shared/SiteHeader";

const heroVideos = [
  {
    id: "racehorse",
    label: "Đường đua & Chiến mã",
    webm: "/video/hero-racehorse.webm",
    mp4: "/video/hero-racehorse.mp4",
    poster: "/img/hero-racehorse.webp",
  },
  {
    id: "training",
    label: "Huấn luyện & Vượt rào",
    webm: "/video/equine-training.webm",
    mp4: "/video/equine-training.mp4",
    poster: "/img/hero-racehorse.webp",
  },
] as const;

const heroBenchmarks = [
  {
    value: "06",
    unit: "Vai trò chuyên biệt",
    detail: "Phân quyền độc lập theo chức năng",
  },
  {
    value: "06",
    unit: "Phân hệ nghiệp vụ",
    detail: "Chuồng trại · Huấn luyện · Thú y · Tài chính",
  },
  {
    value: "3D",
    unit: "Mô phỏng & Chấn thương",
    detail: "Theo dõi trực quan trên mô hình giải phẫu",
  },
  {
    value: "24/7",
    unit: "Đồng bộ thời gian thực",
    detail: "Tự động khóa lịch tập khi có cảnh báo y tế",
  },
];

const roles = [
  {
    code: "CLUB_MANAGER",
    shortLabel: "Quản lý CLB",
    category: "Điều hành trung tâm",
    title: "Quản lý Câu lạc bộ",
    description:
      "Điều phối tổng thể hoạt động câu lạc bộ: phê duyệt hồ sơ ngựa mới, phân công chăm sóc cho Groom, quản lý kho vật tư, tổ chức giải đấu và kiểm soát thu chi.",
    focus: "Điều hành toàn diện · Phê duyệt · Tài chính",
    image: "/img/hero-racehorse.webp",
    capabilities: [
      "Phê duyệt tài khoản nhân sự và yêu cầu đăng ký hồ sơ ngựa mới",
      "Quản lý kho thức ăn, thuốc thú y, thiết bị và cảnh báo tồn kho tối thiểu",
      "Điều phối xử lý sự cố chuồng trại và theo dõi nhật ký kiểm toán hệ thống",
      "Tổ chức giải đấu, ghi nhận thứ hạng và tổng hợp báo cáo tài chính CLB",
    ],
  },
  {
    code: "HEAD_TRAINER",
    shortLabel: "HLV Trưởng",
    category: "Huấn luyện & Thể lực",
    title: "Huấn luyện viên trưởng",
    description:
      "Xây dựng giáo án huấn luyện theo giai đoạn, lập lịch tập hàng tuần, vận hành trình giả lập đường đua 3D và phân tích vận tốc, nhịp tim, thể lực.",
    focus: "Giáo án huấn luyện · Giả lập 3D · Phân tích phong độ",
    image: "/img/hero-racehorse.webp",
    capabilities: [
      "Thiết lập giáo án huấn luyện cá nhân hóa và kiểm soát xung đột lịch tập",
      "Chạy mô phỏng đường đua 3D trên mặt sân cỏ, đất nện và tổng hợp",
      "Theo dõi trực tiếp vận tốc, nhịp tim (BPM) và mức tiêu hao thể lực",
      "Đánh giá mức độ sẵn sàng thi đấu và đăng ký chiến mã tham gia giải",
    ],
  },
  {
    code: "HEAD_VETERINARIAN",
    shortLabel: "Thú y trưởng",
    category: "Điều phối y tế toàn trại",
    title: "Bác sĩ thú y trưởng",
    description:
      "Điều phối lịch khám định kỳ toàn đội ngũ thú y, phân công bác sĩ phụ trách từng khu chuồng, giám sát chấn thương 3D và phê duyệt trạng thái an toàn sinh học.",
    focus: "Điều phối lịch khám · Giám sát chấn thương · Phê duyệt y tế",
    image: "/img/stable-horse.webp",
    capabilities: [
      "Điều phối lịch khám và phân bổ khối lượng công việc cho các bác sĩ thú y",
      "Theo dõi tổng thể tình trạng chuồng cách ly, chuồng chấn thương và phác đồ",
      "Giám sát điểm chấn thương trên mô hình giải phẫu 3D và khóa lịch tập",
      "Đảm bảo tuân thủ lịch tiêm phòng, tẩy giun và chăm sóc định kỳ toàn trại",
    ],
  },
  {
    code: "VETERINARIAN",
    shortLabel: "Bác sĩ Thú y",
    category: "Lâm sàng & Chấn thương 3D",
    title: "Bác sĩ thú y",
    description:
      "Thực hiện khám lâm sàng định kỳ, kê đơn điều trị, đánh dấu vị trí tổn thương trên mô hình giải phẫu ngựa 3D và kích hoạt cơ chế bảo vệ y tế tự động.",
    focus: "Khám lâm sàng · Giải phẫu 3D · Kiểm soát cách ly",
    image: "/img/stable-horse.webp",
    capabilities: [
      "Ghi nhận sinh hiệu lâm sàng (nhiệt độ, nhịp tim, nhịp thở) và lập bệnh án",
      "Đánh dấu trực quan điểm chấn thương trên mô hình khung xương và cơ 3D",
      "Tự động khóa quyền xếp lịch tập khi ngựa đang điều trị hoặc cách ly",
      "Thiết lập khẩu phần ăn điều trị chuyên biệt phối hợp cùng bộ phận Groom",
    ],
  },
  {
    code: "GROOM",
    shortLabel: "Nhân viên Groom",
    category: "Chăm sóc chuồng trại",
    title: "Nhân viên chăm sóc (Groom)",
    description:
      "Thực thi lịch chăm sóc hàng ngày tại khu vực chuồng phụ trách: cho ăn theo đúng khẩu phần, vệ sinh chuồng, xuất vật tư tiêu hao và báo cáo sự cố tức thời.",
    focus: "Lịch chăm sóc · Khẩu phần ăn · Báo cáo hiện trường",
    image: "/img/stable-horse.webp",
    capabilities: [
      "Cập nhật tiến độ công việc hàng ngày: cho ăn, tắm rửa, dắt bộ, vệ sinh chuồng",
      "Tra cứu chính xác khẩu phần dinh dưỡng và lưu ý dị ứng của từng cá thể ngựa",
      "Ghi nhận phiếu yêu cầu vật tư, thức ăn và thảo dược bổ sung",
      "Gửi cảnh báo sự cố sức khỏe hoặc chuồng trại trực tiếp cho Quản lý và Thú y",
    ],
  },
  {
    code: "HORSE_OWNER",
    shortLabel: "Chủ sở hữu",
    category: "Giám sát tài sản & Đầu tư",
    title: "Chủ sở hữu ngựa",
    description:
      "Theo dõi toàn diện tình trạng sức khỏe, tiến độ giáo án tập luyện, lịch sử giải đấu, giải thưởng và bảng kê chi phí nuôi dưỡng minh bạch.",
    focus: "Theo dõi sức khỏe · Lịch tập luyện · Báo cáo thu chi",
    image: "/img/hero-racehorse.webp",
    capabilities: [
      "Đăng ký hồ sơ ngựa mới, bổ sung giấy tờ và theo dõi tiến độ phê duyệt",
      "Xem hồ sơ phả hệ, trạng thái sức khỏe hiện tại và lịch sử khám thú y",
      "Tra cứu lịch tập, thành tích thi đấu và tổng tiền thưởng tích lũy",
      "Kiểm tra chi tiết chi phí nuôi dưỡng, điều trị và hiệu quả đầu tư",
    ],
  },
];

const workflows = [
  {
    number: "01",
    icon: BookOpen,
    title: "Hồ sơ & Lý lịch chiến mã",
    description:
      "Lưu trữ chuẩn hóa phả hệ, năm sinh, microchip, hộ chiếu ngựa, phân khu chuồng trại và lịch sử sở hữu.",
    meta: "Phả hệ · Chuồng trại · Chủ sở hữu",
  },
  {
    number: "02",
    icon: CalendarDays,
    title: "Giáo án & Lịch tập thông minh",
    description:
      "Thiết lập giáo án theo từng giai đoạn thể lực, phân công nhân sự phụ trách và tự động phát hiện trùng lịch.",
    meta: "Giáo án · Lịch tuần · Chống trùng lịch",
  },
  {
    number: "03",
    icon: Stethoscope,
    title: "Thú y & Giải phẫu chấn thương 3D",
    description:
      "Cập nhật bệnh án, đơn thuốc, định vị chấn thương trên mô hình 3D và tự động khóa lịch tập khi có rủi ro.",
    meta: "Bệnh án · Mô hình 3D · Khóa an toàn",
  },
  {
    number: "04",
    icon: Warehouse,
    title: "Chăm sóc chuồng trại & Kho vật tư",
    description:
      "Theo dõi khẩu phần dinh dưỡng, danh sách công việc hàng ngày của Groom, tồn kho theo lô và xử lý sự cố.",
    meta: "Khẩu phần · Giao việc · Tồn kho",
  },
  {
    number: "05",
    icon: Activity,
    title: "Giả lập đường đua 3D & Sinh hiệu",
    description:
      "Tái hiện buổi tập và đường đua theo thời gian thực trên 3 mặt sân, ghi nhận vận tốc, nhịp tim và hồi phục.",
    meta: "Đường đua 3D · Nhịp tim · Vận tốc",
  },
  {
    number: "06",
    icon: Wallet,
    title: "Tài chính & Giải đấu chính thức",
    description:
      "Tổng hợp chi phí nuôi dưỡng, y tế, lệ phí thi đấu và tiền thưởng để đánh giá hiệu suất từng chiến mã.",
    meta: "Thu chi · Giải đấu · Minh bạch",
  },
];

const coreValues = [
  {
    number: "01. Dữ liệu tập trung",
    title: "Một hồ sơ xuyên suốt vòng đời chiến mã",
    description:
      "Phả hệ, chuồng trại, lịch sử khám lâm sàng, đơn thuốc và chỉ số tốc độ được đồng bộ trên một nguồn dữ liệu duy nhất cho cả 6 vai trò.",
    proof: "Loại bỏ hoàn toàn phân mảnh sổ sách",
  },
  {
    number: "02. An toàn sinh học",
    title: "Khóa lịch tập tự động khi phát sinh rủi ro y tế",
    description:
      "Ngay khi Bác sĩ thú y đánh dấu chấn thương trên mô hình 3D hoặc chuyển chuồng cách ly, hệ thống lập tức chặn xếp lịch tập của HLV Trưởng.",
    proof: "Đồng bộ cảnh báo thú y thời gian thực",
  },
  {
    number: "03. Minh bạch vận hành",
    title: "Đối soát tài chính & thành tích rõ ràng",
    description:
      "Chi phí thức ăn, vật tư, điều trị thú y và tiền thưởng giải đấu được hạch toán trực tiếp theo từng cá thể ngựa cho Quản lý và Chủ sở hữu.",
    proof: "Báo cáo trực quan theo từng chiến mã",
  },
];

export default function HomePage() {
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setCurrentUser(getUser());
  }, []);

  const activeVideo = heroVideos[activeVideoIndex] ?? heroVideos[0];
  const activeRole = roles[selectedRoleIndex] ?? roles[0];
  const systemHref = currentUser ? routeForRole(currentUser.roleName) : Routes.login;
  const systemLabel = currentUser ? "Vào bảng điều khiển" : "Truy cập hệ thống";

  function toggleHeroVideo() {
    const video = heroVideoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setIsVideoPlaying(true);
    } else {
      video.pause();
      setIsVideoPlaying(false);
    }
  }

  function selectHeroVideo(index: number) {
    setActiveVideoIndex(index);
    setIsVideoPlaying(true);
  }

  return (
    <div className="landing min-h-screen bg-white text-[#101732]">
      <a className="skip-link" href="#main-content">
        Chuyển đến nội dung chính
      </a>
      <SiteHeader />

      <main id="main-content" className="pt-20 lg:pt-[84px]">
        {/* 1. LIVE VIDEO HERO BANNER & BENCHMARK BAR */}
        <section id="tong-quan" className="vf-hero relative overflow-hidden bg-[#101732] text-white">
          <div className="absolute inset-0">
            <video
              aria-label={`Video trang chủ: ${activeVideo.label}`}
              autoPlay
              className="vf-sharp-video h-full w-full object-cover object-center"
              data-testid="hero-background-video"
              key={activeVideo.id}
              loop
              muted
              onPause={() => setIsVideoPlaying(false)}
              onPlay={() => setIsVideoPlaying(true)}
              playsInline
              poster={activeVideo.poster}
              preload="auto"
              ref={heroVideoRef}
            >
              <source src={activeVideo.mp4} type="video/mp4" />
              <source src={activeVideo.webm} type="video/webm" />
            </video>
            <div className="vf-hero-scrim absolute inset-0" />
          </div>

          <div className="relative mx-auto flex min-h-[520px] max-w-7xl flex-col justify-between px-6 pb-12 pt-10 sm:px-8 lg:min-h-[600px] lg:px-12 lg:pb-16 lg:pt-14">
            <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
              <div
                aria-label="Chọn cảnh video trang chủ"
                className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-[6px] border border-white/30 bg-slate-900/45 p-1 backdrop-blur-md"
                role="group"
              >
                {heroVideos.map((vid, idx) => {
                  const selected = idx === activeVideoIndex;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`whitespace-nowrap rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-xs ${
                        selected
                          ? "bg-[#1040C5] text-white"
                          : "text-white/90 hover:bg-white/15 hover:text-white"
                      }`}
                      key={vid.id}
                      onClick={() => selectHeroVideo(idx)}
                      type="button"
                    >
                      {vid.label}
                    </button>
                  );
                })}
                <button
                  aria-label={isVideoPlaying ? "Tạm dừng video nền" : "Phát video nền"}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] text-white/95 transition-colors hover:bg-white/20 sm:h-7 sm:w-7"
                  onClick={toggleHeroVideo}
                  type="button"
                >
                  {isVideoPlaying ? <Pause size={13} /> : <Play size={13} />}
                </button>
              </div>
            </div>

            <div className="mt-20 max-w-3xl lg:mt-28">
              <h1 className="text-3xl font-semibold leading-[1.3] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(10,20,40,0.7)] sm:text-4xl sm:leading-[1.28] lg:text-[46px] lg:leading-[1.25] [text-wrap:balance]">
                Điều hành chuồng trại, huấn luyện &amp; thú y{" "}
                <span className="text-[#7DD3FC]">trên một hệ thống</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90 drop-shadow-[0_1px_8px_rgba(10,20,40,0.65)] sm:text-lg">
                Đồng bộ hồ sơ phả hệ, giáo án huấn luyện 3D, giám sát chấn thương thú y và báo cáo tài chính minh bạch theo thời gian thực.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link
                  className="vf-btn-primary !h-12 !px-7 whitespace-nowrap"
                  href={systemHref}
                >
                  {systemLabel}
                  <ArrowRight size={16} />
                </Link>
                <Link
                  className="vf-btn-hero-outline !h-12 !px-7 whitespace-nowrap"
                  href={Routes.register}
                >
                  Đăng ký Chủ ngựa
                </Link>
              </div>
            </div>
          </div>

          <div className="relative border-y border-slate-200 bg-white text-[#101732]">
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-y-6 px-6 py-7 sm:grid-cols-2 sm:gap-x-8 sm:px-8 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-slate-200 lg:px-12 lg:py-8">
              {heroBenchmarks.map((item) => (
                <div
                  className="lg:px-8 lg:first:pl-0 lg:last:pr-0"
                  key={item.unit}
                >
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl font-semibold tracking-tight text-[#1040C5] tabular-nums sm:text-3xl">
                      {item.value}
                    </span>
                    <span className="text-[15px] font-semibold text-[#101732]">
                      {item.unit}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-[#475569]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. HỆ SINH THÁI 6 VAI TRÒ CHUYÊN BIỆT */}
        <section id="vai-tro" className="bg-[#F4F7FB] py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="max-w-3xl">
                <p className="vf-section-label">Hệ sinh thái vận hành</p>
                <h2 className="mt-2.5 text-2xl font-semibold leading-[1.24] tracking-[-0.015em] text-[#101732] sm:text-3xl lg:text-[36px] [text-wrap:balance]">
                  Không gian làm việc chuyên biệt cho 6&nbsp;vai&nbsp;trò
                </h2>
                <p className="mt-3.5 max-w-[58ch] text-base leading-[1.7] text-[#475569]">
                  Mỗi vị trí được thiết kế giao diện và quyền hạn riêng biệt, liên thông dữ liệu tức thời trên cùng một nền tảng.
                </p>
              </div>
              <Link
                className="vf-btn-secondary self-start whitespace-nowrap lg:self-auto"
                href={systemHref}
              >
                {currentUser ? "Mở không gian làm việc" : "Mở cổng đăng nhập"}
                <ArrowRight size={16} />
              </Link>
            </div>

            <div
              aria-label="Chọn vai trò để xem chi tiết"
              className="mt-10 grid grid-cols-2 gap-2 rounded-[8px] border border-slate-200 bg-white p-1.5 sm:grid-cols-3 lg:mt-12 lg:grid-cols-6"
              role="tablist"
            >
              {roles.map((role, index) => {
                const isSelected = index === selectedRoleIndex;
                return (
                  <button
                    aria-selected={isSelected}
                    className={`shrink-0 whitespace-nowrap rounded-[6px] px-3 py-2.5 text-sm font-medium transition-colors ${
                      isSelected
                        ? "bg-[#1040C5] text-white"
                        : "text-[#475569] hover:bg-slate-100 hover:text-[#101732]"
                    }`}
                    key={role.code}
                    onClick={() => setSelectedRoleIndex(index)}
                    role="tab"
                    type="button"
                  >
                    {role.shortLabel}
                  </button>
                );
              })}
            </div>

            <div
              className="mt-6 grid items-center gap-8 rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-12 lg:gap-12 lg:p-10"
              role="tabpanel"
            >
              <div className="flex flex-col justify-between lg:col-span-6">
                <div>
                  <span className="text-sm font-semibold text-[#1040C5]">
                    {activeRole.category}
                  </span>

                  <h3 className="mt-2 text-2xl font-semibold text-[#101732] sm:text-[28px]">
                    {activeRole.title}
                  </h3>
                  <p className="mt-3 text-base leading-[1.7] text-[#475569]">
                    {activeRole.description}
                  </p>

                  <ul className="mt-6 divide-y divide-slate-100 border-y border-slate-100">
                    {activeRole.capabilities.map((cap, idx) => (
                      <li
                        className="flex items-baseline gap-3 py-3 text-[15px] leading-[1.6] text-[#334155]"
                        key={cap}
                      >
                        <span className="text-xs font-semibold text-[#1040C5] tabular-nums">
                          0{idx + 1}
                        </span>
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-3.5">
                  <Link
                    className="vf-btn-primary whitespace-nowrap"
                    href={systemHref}
                  >
                    {currentUser ? "Vào bảng điều khiển" : "Đăng nhập hệ thống"}
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    className="vf-btn-secondary whitespace-nowrap"
                    href={Routes.register}
                  >
                    Đăng ký Chủ ngựa
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="overflow-hidden rounded-[8px] border border-slate-200 shadow-sm">
                  <div className="relative aspect-[16/11] w-full overflow-hidden bg-slate-100">
                    <Image
                      alt={activeRole.title}
                      className="object-cover object-center"
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      src={activeRole.image}
                    />
                  </div>
                </div>
                <p className="mt-3 px-1 text-sm font-medium text-slate-600">
                  {activeRole.focus}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 6 PHÂN HỆ NGHIỆP VỤ LIÊN THÔNG */}
        <section id="van-hanh" className="bg-white py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="max-w-3xl">
              <p className="vf-section-label">Quy trình &amp; Công nghệ</p>
              <h2 className="mt-2.5 text-2xl font-semibold leading-[1.24] tracking-[-0.015em] text-[#101732] sm:text-3xl lg:text-[36px] [text-wrap:balance]">
                6 phân hệ nghiệp vụ liên&nbsp;thông khép&nbsp;kín
              </h2>
              <p className="mt-3.5 max-w-[58ch] text-base leading-[1.7] text-[#475569]">
                Mọi thao tác nghiệp vụ tại chuồng trại, đường đua và phòng khám thú y đều được đồng bộ tức thời trên toàn hệ thống.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-7">
              {workflows.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    className="flex flex-col justify-between rounded-[8px] border border-slate-200 bg-white p-7 shadow-sm transition-colors hover:border-[#BFDBFE] lg:p-8"
                    key={item.number}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] bg-[#EFF6FF] text-[#1040C5]">
                          <Icon size={20} />
                        </span>
                        <span className="text-xs font-semibold text-slate-400 tabular-nums">
                          {item.number}
                        </span>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold leading-snug text-[#101732]">
                        {item.title}
                      </h3>
                      <p className="mt-2.5 text-[15px] leading-[1.7] text-[#475569]">
                        {item.description}
                      </p>
                    </div>
                    <div className="mt-6 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500">
                      {item.meta}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. VỀ EQUINE & 3 TRỤ CỘT CỐT LÕI */}
        <section id="gioi-thieu" className="bg-[#F4F7FB] py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
              <div className="lg:col-span-6">
                <p className="vf-section-label">Về Equine</p>
                <h2 className="mt-2.5 text-2xl font-semibold leading-[1.24] tracking-[-0.015em] text-[#101732] sm:text-3xl lg:text-[36px] [text-wrap:balance]">
                  Chuẩn hóa quản trị câu&nbsp;lạc&nbsp;bộ ngựa&nbsp;đua hiện&nbsp;đại
                </h2>
                <p className="mt-4 text-base leading-[1.75] text-[#475569]">
                  Equine số hóa toàn diện từng mắt xích vận hành — từ quản lý hồ sơ phả hệ, điều phối chuồng trại,
                  hoạch định giáo án huấn luyện thể lực cho đến kiểm soát lâm sàng thú y trên mô hình giải phẫu 3D.
                </p>

                <div className="mt-7 border-t border-slate-200 pt-6">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <div>
                      <span className="text-2xl font-semibold text-[#1040C5] tabular-nums">
                        100%
                      </span>
                      <p className="mt-1 text-sm text-[#475569]">
                        Hồ sơ phả hệ &amp; bệnh án số hóa
                      </p>
                    </div>
                    <div>
                      <span className="text-2xl font-semibold text-[#1040C5] tabular-nums">
                        03 Mặt sân
                      </span>
                      <p className="mt-1 text-sm text-[#475569]">
                        Giả lập cỏ, đất nện &amp; tổng hợp
                      </p>
                    </div>
                    <div>
                      <span className="text-2xl font-semibold text-[#1040C5] tabular-nums">
                        24/7
                      </span>
                      <p className="mt-1 text-sm text-[#475569]">
                        Cảnh báo y tế &amp; khóa lịch tập
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
                  <div className="relative aspect-[16/10] w-full overflow-hidden">
                    <Image
                      alt="Chăm sóc và vận hành ngựa đua tại câu lạc bộ Equine"
                      className="object-cover object-center"
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      src="/img/stable-horse.webp"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3 lg:gap-7">
              {coreValues.map((item) => (
                <article
                  className="flex flex-col justify-between rounded-[8px] border border-slate-200 bg-white p-7 shadow-sm transition-colors hover:border-[#BFDBFE] lg:p-8"
                  key={item.number}
                >
                  <div>
                    <span className="text-sm font-semibold text-[#1040C5]">
                      {item.number}
                    </span>
                    <h3 className="mt-3 text-lg font-semibold leading-snug text-[#101732]">
                      {item.title}
                    </h3>
                    <p className="mt-2.5 text-[15px] leading-[1.7] text-[#475569]">
                      {item.description}
                    </p>
                  </div>
                  <div className="mt-6 border-t border-slate-100 pt-4 text-xs font-medium text-slate-600">
                    {item.proof}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. AN TOÀN Y TẾ & CTA BANNER */}
        <section
          id="an-toan"
          className="border-t border-[#BFDBFE] bg-gradient-to-r from-[#EFF6FF] via-[#F8FAFC] to-white py-16 text-[#101732] lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-8">
                <p className="vf-section-label">
                  Tiêu chuẩn an toàn &amp; Bảo mật vận hành
                </p>
                <h2 className="mt-2.5 text-2xl font-semibold leading-[1.26] tracking-[-0.015em] text-[#101732] sm:text-3xl [text-wrap:balance]">
                  Kiểm soát rủi ro y&nbsp;tế trước mỗi buổi tập và minh&nbsp;bạch&nbsp;hóa toàn bộ chu&nbsp;trình quản&nbsp;lý
                </h2>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#475569]">
                  <span>Tự động chặn lịch tập khi ngựa chấn thương</span>
                  <span aria-hidden="true">·</span>
                  <span>Theo dõi chấn thương 3D trực quan</span>
                  <span aria-hidden="true">·</span>
                  <span>Báo cáo tài chính thời gian thực</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 lg:col-span-4 lg:justify-end">
                <Link
                  className="vf-btn-primary whitespace-nowrap"
                  href={systemHref}
                >
                  {currentUser ? "Vào bảng điều khiển" : "Đăng nhập hệ thống"}
                  <ArrowRight size={16} />
                </Link>
                <Link
                  className="vf-btn-secondary whitespace-nowrap"
                  href={Routes.register}
                >
                  Đăng ký Chủ ngựa
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
