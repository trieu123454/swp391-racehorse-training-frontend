"use client";
import { Routes } from "@/routes/Routes";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { login } from "@/api/client";
import { routeForRole } from "@/lib/roles";
import { saveSession } from "@/lib/session";
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
    value: "05",
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

const visionPillars = [
  {
    index: "01. Tầm nhìn",
    title: "Định hình chuẩn mực quản trị ngựa đua hiện đại",
    description:
      "Trở thành hệ thống điều hành tiêu chuẩn cho các câu lạc bộ ngựa đua chuyên nghiệp, tiên phong chuẩn hóa dữ liệu sinh học, huấn luyện thể lực và giải đấu trên nền tảng số.",
    meta: "Chuẩn hóa dữ liệu · Mô phỏng 3D · Quản trị tập trung",
  },
  {
    index: "02. Sứ mệnh",
    title: "Vì sự an toàn sinh học và phong độ đỉnh cao của chiến mã",
    description:
      "Bảo vệ sức khỏe từng cá thể ngựa đua thông qua quy trình giám sát y tế chủ động, ngăn ngừa rủi ro chấn thương trước mỗi buổi tập và minh bạch hóa hiệu quả đầu tư.",
    meta: "An toàn y tế · Tối ưu thể lực · Bền vững vận hành",
  },
  {
    index: "03. Triết lý vận hành",
    title: "Đặt sức khỏe chiến mã và tính minh bạch làm trọng tâm",
    description:
      "Mọi quyết định từ xếp lịch huấn luyện, điều chỉnh khẩu phần ăn đến đăng ký thi đấu đều dựa trên dữ liệu lâm sàng và chỉ số sinh hiệu thực tế được cập nhật tức thời.",
    meta: "Liên thông 5 vai trò · Phản hồi tức thời · Chính xác tuyệt đối",
  },
];

const coreValues = [
  {
    number: "01. Chuẩn xác dữ liệu nguồn",
    title: "Một hồ sơ xuyên suốt vòng đời chiến mã",
    description:
      "Toàn bộ phả hệ, vị trí chuồng trại, lịch sử khám lâm sàng, đơn thuốc và chỉ số tốc độ qua từng chặng đua được lưu trữ tập trung, loại bỏ hoàn toàn tình trạng phân mảnh sổ sách.",
    proof: "100% hồ sơ ngựa đồng bộ giữa 5 bộ phận",
  },
  {
    number: "02. An toàn sinh học tuyệt đối",
    title: "Khóa lịch tập tự động khi phát sinh rủi ro y tế",
    description:
      "Ngay khi Bác sĩ thú y đánh dấu chấn thương trên mô hình 3D hoặc chuyển trạng thái cách ly, hệ thống lập tức chặn xếp lịch tập của HLV Trưởng nhằm bảo vệ chiến mã.",
    proof: "Đồng bộ cảnh báo thú y theo thời gian thực",
  },
  {
    number: "03. Minh bạch tài chính & thành tích",
    title: "Báo cáo trực tiếp cho Chủ sở hữu & Quản lý CLB",
    description:
      "Chi phí thức ăn, vật tư chuồng trại, dịch vụ thú y và tiền thưởng giải đấu được hạch toán rõ ràng theo từng cá thể ngựa với biểu đồ trực quan.",
    proof: "Đối soát thu chi & thành tích minh bạch",
  },
];

const roles = [
  {
    code: "CLUB_MANAGER",
    email: "manager@equine.vn",
    shortLabel: "Quản lý CLB",
    category: "Điều hành trung tâm",
    title: "Quản lý Câu lạc bộ",
    description:
      "Điều phối tổng thể hoạt động câu lạc bộ: phê duyệt hồ sơ ngựa mới, phân công công việc chăm sóc cho Groom, quản lý tồn kho vật tư, tổ chức giải đấu và kiểm soát thu chi.",
    focus: "Điều hành toàn diện · Phê duyệt · Tài chính",
    image: "/img/hero-racehorse.webp",
    capabilities: [
      "Phê duyệt tài khoản nhân sự và yêu cầu đăng ký hồ sơ ngựa mới",
      "Quản lý kho thức ăn, thuốc thú y, trang thiết bị và cảnh báo tồn kho tối thiểu",
      "Điều phối xử lý sự cố chuồng trại và theo dõi nhật ký kiểm toán hệ thống",
      "Tổ chức giải đấu, ghi nhận thứ hạng và tổng hợp báo cáo tài chính CLB",
    ],
  },
  {
    code: "HEAD_TRAINER",
    email: "trainer@equine.vn",
    shortLabel: "HLV Trưởng",
    category: "Huấn luyện & Thể lực",
    title: "Huấn luyện viên trưởng",
    description:
      "Xây dựng giáo án huấn luyện theo giai đoạn, lập lịch tập hàng tuần, vận hành trình giả lập đường đua 3D và phân tích chuyên sâu vận tốc, nhịp tim, thể lực.",
    focus: "Giáo án huấn luyện · Giả lập 3D · Phân tích phong độ",
    image: "/img/tracks/grass.png",
    capabilities: [
      "Thiết lập giáo án huấn luyện cá nhân hóa và kiểm soát xung đột lịch tập",
      "Chạy mô phỏng đường đua 3D trên mặt sân cỏ, đất nện và tổng hợp",
      "Theo dõi trực tiếp vận tốc, nhịp tim (BPM) và mức tiêu hao thể lực",
      "Đánh giá mức độ sẵn sàng thi đấu và đề xuất chiến mã tham gia giải",
    ],
  },
  {
    code: "VETERINARIAN",
    email: "vet@equine.vn",
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
    email: "groom@equine.vn",
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
      "Ghi nhận phiếu xuất kho vật tư, thức ăn và thảo dược bổ sung",
      "Gửi cảnh báo sự cố sức khỏe hoặc chuồng trại trực tiếp cho Quản lý và Thú y",
    ],
  },
  {
    code: "HORSE_OWNER",
    email: "owner@equine.vn",
    shortLabel: "Chủ sở hữu",
    category: "Giám sát tài sản & Đầu tư",
    title: "Chủ sở hữu ngựa",
    description:
      "Theo dõi toàn diện tình trạng sức khỏe, tiến độ giáo án tập luyện, video mô phỏng đường đua, lịch sử giải thưởng và bảng kê chi phí minh bạch.",
    focus: "Theo dõi sức khỏe · Video tập luyện · Báo cáo thu chi",
    image: "/img/hero-racehorse.webp",
    capabilities: [
      "Xem hồ sơ phả hệ, trạng thái sức khỏe hiện tại và lịch sử khám thú y",
      "Theo dõi lịch tập luyện, thông số vận tốc và phát lại buổi tập mô phỏng",
      "Tra cứu thành tích thi đấu, huy chương và tổng tiền thưởng tích lũy",
      "Kiểm tra chi tiết hóa đơn nuôi dưỡng, chi phí điều trị và lợi nhuận ròng",
    ],
  },
];

const workflows = [
  {
    number: "01. Hồ sơ & Lý lịch",
    title: "Quản trị danh mục chiến mã tập trung",
    description:
      "Lưu trữ chuẩn hóa phả hệ, ngày sinh, màu lông, phân khu chuồng trại, chủ sở hữu và trạng thái vận hành.",
    meta: "Phả hệ · Chuồng trại · Chủ sở hữu",
  },
  {
    number: "02. Giáo án & Lịch tập",
    title: "Hoạch định chu kỳ huấn luyện thông minh",
    description:
      "Thiết lập giáo án theo từng giai đoạn thể lực, phân công nhân sự phụ trách và tự động phát hiện trùng lịch.",
    meta: "Giáo án · Lịch tuần · Kiểm tra xung đột",
  },
  {
    number: "03. Thú y & Chấn thương 3D",
    title: "Chẩn đoán lâm sàng & định vị giải phẫu 3D",
    description:
      "Cập nhật bệnh án, đơn thuốc, định vị chấn thương trên mô hình 3D và tự động khóa lịch tập khi có rủi ro.",
    meta: "Bệnh án · Mô hình 3D · Khóa an toàn",
  },
  {
    number: "04. Chăm sóc & Kho vật tư",
    title: "Vận hành chuồng trại & kiểm soát định mức",
    description:
      "Theo dõi khẩu phần dinh dưỡng, danh sách công việc hàng ngày của Groom, xuất nhập tồn vật tư và xử lý sự cố.",
    meta: "Khẩu phần · Giao việc · Tồn kho",
  },
  {
    number: "05. Giả lập & Cảm biến",
    title: "Mô phỏng đường đua 3D & đo lường sinh hiệu",
    description:
      "Tái hiện cuộc đua theo thời gian thực trên nhiều mặt sân, ghi nhận vận tốc, nhịp tim và chỉ số hồi phục.",
    meta: "Đường đua 3D · Nhịp tim · Vận tốc",
  },
  {
    number: "06. Tài chính & Giải đấu",
    title: "Hạch toán minh bạch chi phí & giải thưởng",
    description:
      "Tổng hợp chi phí nuôi dưỡng, y tế, lệ phí thi đấu và tiền thưởng để phân tích hiệu suất đầu tư từng chiến mã.",
    meta: "Thu chi · Giải đấu · Hiệu suất đầu tư",
  },
];

export default function HomePage() {
  const router = useRouter();
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
  const [launchingRoleEmail, setLaunchingRoleEmail] = useState<string | null>(null);

  const activeVideo = heroVideos[activeVideoIndex] ?? heroVideos[0];
  const activeRole = roles[selectedRoleIndex] ?? roles[0];

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

  async function handleQuickLaunchRole(email: string) {
    setLaunchingRoleEmail(email);
    try {
      const auth = await login(email, "password123");
      saveSession(auth, true);
      router.push(routeForRole(auth.user.roleName));
    } catch {
      router.push(Routes.login);
    } finally {
      setLaunchingRoleEmail(null);
    }
  }

  return (
    <div className="landing min-h-screen bg-white text-[#1F2125]">
      <a className="skip-link" href="#main-content">
        Chuyển đến nội dung chính
      </a>
      <SiteHeader />

      <main id="main-content" className="pt-20 lg:pt-[84px]">
        {/* 1. BRIGHT LIVE VIDEO HERO BANNER */}
        <section id="tong-quan" className="vf-hero relative overflow-hidden bg-[#1E3A5F] text-white">
          <div className="absolute inset-0">
            <video
              aria-label={`Video trang chủ: ${activeVideo.label}`}
              autoPlay
              className="h-full w-full object-cover object-center brightness-[1.06] contrast-[1.03] saturate-[1.06]"
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
              <source src={activeVideo.webm} type="video/webm" />
              <source src={activeVideo.mp4} type="video/mp4" />
            </video>
            <div className="vf-hero-scrim absolute inset-0" />
          </div>

          <div className="relative mx-auto flex min-h-[520px] max-w-7xl flex-col justify-between px-6 pb-12 pt-10 sm:px-8 lg:min-h-[600px] lg:px-12 lg:pb-16 lg:pt-14">
            {/* Top-right Interactive Video Switcher & Playback Control */}
            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
              <div
                aria-label="Chọn cảnh video trang chủ"
                className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-[4px] border border-white/35 bg-slate-900/35 p-1 backdrop-blur-md"
                role="group"
              >
                {heroVideos.map((vid, idx) => {
                  const selected = idx === activeVideoIndex;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`rounded-[3px] px-2.5 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-xs font-normal whitespace-nowrap transition-colors ${
                        selected
                          ? "bg-[#1464F4] text-white"
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
                  className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-[3px] text-white/95 transition-colors hover:bg-white/20"
                  onClick={toggleHeroVideo}
                  type="button"
                >
                  {isVideoPlaying ? <Pause size={13} /> : <Play size={13} />}
                </button>
              </div>
            </div>

            {/* Bottom-left Headline & Primary Actions */}
            <div className="mt-24 max-w-3xl lg:mt-32">
              <h1 className="text-3xl font-normal leading-[1.2] tracking-[-0.015em] text-white drop-shadow-[0_2px_10px_rgba(10,20,40,0.35)] sm:text-4xl lg:text-[46px] [text-wrap:balance]">
                Điều hành chuồng&nbsp;trại, huấn&nbsp;luyện &amp; thú&nbsp;y{" "}
                <span className="text-[#93C5FD]">trên một hệ&nbsp;thống</span>
              </h1>

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link
                  className="vf-btn-primary !h-12 !px-7 whitespace-nowrap"
                  href={Routes.login}
                >
                  Truy cập hệ thống
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

          {/* Bright White Architectural Benchmark Bar */}
          <div className="relative border-y border-slate-200 bg-white text-[#1F2125]">
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-y-6 px-6 py-7 sm:grid-cols-2 sm:gap-x-8 sm:px-8 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-slate-200 lg:px-12 lg:py-8">
              {heroBenchmarks.map((item) => (
                <div
                  className="lg:px-8 lg:first:pl-0 lg:last:pr-0"
                  key={item.unit}
                >
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl font-normal tracking-tight text-[#1464F4] tabular-nums sm:text-3xl">
                      {item.value}
                    </span>
                    <span className="text-[15px] font-normal text-[#1F2125]">
                      {item.unit}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-normal text-[#475569]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. VỀ EQUINE — CORPORATE OVERVIEW WITH LIVE VIDEO SHOWCASE */}
        <section id="gioi-thieu" className="bg-white py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
              <div className="lg:col-span-6">
                <p className="vf-section-label">Về Equine</p>
                <h2 className="mt-2.5 text-2xl font-normal leading-[1.22] tracking-[-0.015em] text-[#1F2125] sm:text-3xl lg:text-[36px] [text-wrap:balance]">
                  Chuẩn hóa quy trình vận&nbsp;hành câu&nbsp;lạc&nbsp;bộ ngựa&nbsp;đua hiện&nbsp;đại
                </h2>
                <p className="mt-5 text-base font-normal leading-[1.75] text-[#475569]">
                  Được phát triển theo tiêu chuẩn quản trị doanh nghiệp hiện đại, Equine số hóa toàn diện
                  mọi mắt xích vận hành trong câu lạc bộ ngựa đua — từ quản lý hồ sơ phả hệ, điều phối chuồng trại,
                  hoạch định giáo án huấn luyện thể lực cho đến kiểm soát lâm sàng thú y trên mô hình giải phẫu 3D.
                </p>
                <p className="mt-4 text-base font-normal leading-[1.75] text-[#475569]">
                  Hệ thống thiết lập luồng dữ liệu xuyên suốt theo thời gian thực, giúp ban quản trị đưa ra quyết định
                  nhanh chóng, giảm thiểu rủi ro chấn thương trên sân tập và mang lại sự minh bạch tối đa cho Chủ sở hữu.
                </p>

                <div className="mt-8 border-t border-slate-200 pt-7">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <div>
                      <span className="text-2xl font-normal text-[#1464F4] tabular-nums">
                        100%
                      </span>
                      <p className="mt-1.5 text-sm font-normal text-[#475569]">
                        Hồ sơ phả hệ &amp; bệnh án số hóa
                      </p>
                    </div>
                    <div>
                      <span className="text-2xl font-normal text-[#1464F4] tabular-nums">
                        03 Mặt sân
                      </span>
                      <p className="mt-1.5 text-sm font-normal text-[#475569]">
                        Giả lập cỏ, đất nện &amp; tổng hợp
                      </p>
                    </div>
                    <div>
                      <span className="text-2xl font-normal text-[#1464F4] tabular-nums">
                        24/7
                      </span>
                      <p className="mt-1.5 text-sm font-normal text-[#475569]">
                        Đồng bộ cảnh báo y tế &amp; lịch tập
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="overflow-hidden rounded-[6px] border border-slate-200 bg-[#F5F7FA]">
                  <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
                    <video
                      aria-label="Video thực tế huấn luyện và vận hành ngựa đua"
                      autoPlay
                      className="h-full w-full object-cover brightness-[1.04]"
                      data-testid="overview-showcase-video"
                      loop
                      muted
                      playsInline
                      poster="/img/hero-racehorse.webp"
                      preload="metadata"
                    >
                      <source src="/video/equine-training.webm" type="video/webm" />
                      <source src="/video/equine-training.mp4" type="video/mp4" />
                    </video>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3.5 text-sm font-normal text-slate-600">
                    <span className="font-normal text-[#1F2125]">
                      Ghi hình thực tế huấn luyện thể lực &amp; giám sát vận động
                    </span>
                    <span className="text-slate-500">Chuồng trại · Phòng khám · Đường đua</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. TẦM NHÌN – SỨ MỆNH – TRIẾT LÝ VẬN HÀNH */}
        <section id="tam-nhin" className="border-y border-slate-200/80 bg-[#F5F7FA] py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="max-w-3xl">
              <p className="vf-section-label">Định hướng chiến lược</p>
              <h2 className="mt-2.5 text-2xl font-normal leading-[1.22] tracking-[-0.015em] text-[#1F2125] sm:text-3xl lg:text-[36px] [text-wrap:balance]">
                Tầm nhìn, Sứ mệnh &amp; Triết lý vận&nbsp;hành
              </h2>
              <p className="mt-3.5 text-base font-normal leading-[1.7] text-[#475569]">
                Nền tảng định hướng mọi quy chuẩn kỹ thuật, quy trình chăm sóc và cơ chế bảo mật phân quyền trên toàn hệ thống.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3 lg:mt-12 lg:gap-8">
              {visionPillars.map((pillar) => (
                <article
                  className="flex flex-col justify-between rounded-[6px] border border-slate-200 border-t-2 border-t-[#1464F4] bg-white p-7 lg:p-8"
                  key={pillar.index}
                >
                  <div>
                    <span className="text-sm font-normal text-[#1464F4]">
                      {pillar.index}
                    </span>
                    <h3 className="mt-3 text-lg font-normal leading-snug text-[#1F2125] lg:text-xl">
                      {pillar.title}
                    </h3>
                    <p className="mt-3 text-[15px] font-normal leading-[1.7] text-[#475569]">
                      {pillar.description}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-4 text-xs font-normal text-slate-500">
                    {pillar.meta}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4. GIÁ TRỊ CỐT LÕI */}
        <section id="gia-tri" className="bg-white py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="max-w-3xl">
              <p className="vf-section-label">Giá trị cốt lõi</p>
              <h2 className="mt-2.5 text-2xl font-normal leading-[1.22] tracking-[-0.015em] text-[#1F2125] sm:text-3xl lg:text-[36px] [text-wrap:balance]">
                3 trụ cột kiến tạo chuẩn mực quản&nbsp;trị
              </h2>
              <p className="mt-3.5 text-base font-normal leading-[1.7] text-[#475569]">
                Kết hợp công nghệ mô phỏng 3D, cơ chế kiểm soát rủi ro y tế tự động và hệ thống kế toán minh bạch.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3 lg:mt-12 lg:gap-8">
              {coreValues.map((item) => (
                <article
                  className="flex flex-col justify-between rounded-[6px] border border-slate-200 bg-[#F8FAFC] p-7 lg:p-8"
                  key={item.number}
                >
                  <div>
                    <span className="text-sm font-normal text-[#1464F4]">
                      {item.number}
                    </span>
                    <h3 className="mt-3 text-lg font-normal leading-snug text-[#1F2125] lg:text-xl">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-[15px] font-normal leading-[1.7] text-[#475569]">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-slate-200/80 pt-4 text-xs font-normal text-slate-600">
                    {item.proof}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. HỆ SINH THÁI 5 VAI TRÒ CHUYÊN BIỆT */}
        <section id="vai-tro" className="border-y border-slate-200/80 bg-[#F5F7FA] py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="max-w-3xl">
                <p className="vf-section-label">Hệ sinh thái vận hành</p>
                <h2 className="mt-2.5 text-2xl font-normal leading-[1.22] tracking-[-0.015em] text-[#1F2125] sm:text-3xl lg:text-[36px] [text-wrap:balance]">
                  Không gian làm việc chuyên biệt cho 5&nbsp;vai&nbsp;trò
                </h2>
                <p className="mt-3.5 text-base font-normal leading-[1.7] text-[#475569]">
                  Mỗi vị trí được thiết kế giao diện và quyền hạn riêng biệt, liên thông dữ liệu tức thời trên cùng một nền tảng.
                </p>
              </div>
              <Link
                className="vf-btn-secondary self-start whitespace-nowrap lg:self-auto"
                href={Routes.login}
              >
                Mở cổng đăng nhập
                <ArrowRight size={16} />
              </Link>
            </div>

            {/* Interactive Segmented Role Selector */}
            <div
              aria-label="Chọn vai trò để xem chi tiết"
              className="mt-10 grid grid-cols-2 gap-2 rounded-[6px] border border-slate-200 bg-white p-1.5 sm:grid-cols-3 lg:mt-12 lg:grid-cols-5"
              role="tablist"
            >
              {roles.map((role, index) => {
                const isSelected = index === selectedRoleIndex;
                return (
                  <button
                    aria-selected={isSelected}
                    className={`rounded-[4px] px-4 py-2.5 text-sm font-normal transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? "bg-[#1464F4] text-white"
                        : "text-[#475569] hover:bg-slate-100 hover:text-[#1F2125]"
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

            {/* Active Role Spotlight Panel */}
            <div
              className="mt-6 grid items-center gap-8 rounded-[6px] border border-slate-200 bg-white p-6 sm:p-8 lg:grid-cols-12 lg:gap-12 lg:p-10"
              role="tabpanel"
            >
              <div className="flex flex-col justify-between lg:col-span-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-normal text-slate-500">
                    <span className="font-normal text-[#1464F4]">{activeRole.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>Tài khoản mẫu: {activeRole.email}</span>
                  </div>

                  <h3 className="mt-2.5 text-2xl font-normal text-[#1F2125] sm:text-[28px]">
                    {activeRole.title}
                  </h3>
                  <p className="mt-3 text-base font-normal leading-[1.7] text-[#475569]">
                    {activeRole.description}
                  </p>

                  <ul className="mt-6 divide-y divide-slate-100 border-y border-slate-100">
                    {activeRole.capabilities.map((cap, idx) => (
                      <li
                        className="flex items-baseline gap-3 py-3 text-[15px] font-normal leading-[1.6] text-[#334155]"
                        key={cap}
                      >
                        <span className="text-xs font-normal text-[#1464F4] tabular-nums">
                          0{idx + 1}
                        </span>
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-3.5">
                  <button
                    className="vf-btn-primary whitespace-nowrap"
                    disabled={launchingRoleEmail !== null}
                    onClick={() => void handleQuickLaunchRole(activeRole.email)}
                    type="button"
                  >
                    {launchingRoleEmail === activeRole.email
                      ? "Đang mở không gian..."
                      : `Truy cập vai trò ${activeRole.shortLabel}`}
                    <ArrowRight size={16} />
                  </button>
                  <Link
                    className="vf-btn-secondary whitespace-nowrap"
                    href={Routes.login}
                  >
                    Đăng nhập tài khoản khác
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="overflow-hidden rounded-[6px] border border-slate-200 bg-[#F5F7FA]">
                  <div className="relative aspect-[16/11] w-full overflow-hidden">
                    <Image
                      alt={activeRole.title}
                      className="object-cover object-center brightness-[1.03]"
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      src={activeRole.image}
                    />
                  </div>
                  <div className="border-t border-slate-200 bg-white px-5 py-3.5">
                    <p className="text-sm font-normal text-slate-600">{activeRole.focus}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. 6 PHÂN HỆ NGHIỆP VỤ LIÊN THÔNG */}
        <section id="van-hanh" className="bg-white py-16 md:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="max-w-3xl">
              <p className="vf-section-label">Quy trình &amp; Công nghệ</p>
              <h2 className="mt-2.5 text-2xl font-normal leading-[1.22] tracking-[-0.015em] text-[#1F2125] sm:text-3xl lg:text-[36px] [text-wrap:balance]">
                6 phân hệ nghiệp vụ liên&nbsp;thông khép&nbsp;kín
              </h2>
              <p className="mt-3.5 text-base font-normal leading-[1.7] text-[#475569]">
                Mọi thao tác nghiệp vụ tại chuồng trại, đường đua và phòng khám thú y đều được đồng bộ tức thời trên toàn hệ thống.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-8">
              {workflows.map((item) => (
                <article
                  className="flex flex-col justify-between rounded-[6px] border border-slate-200 bg-white p-7 transition-colors hover:border-slate-300 lg:p-8"
                  key={item.number}
                >
                  <div>
                    <span className="text-sm font-normal text-[#1464F4] tabular-nums">
                      {item.number}
                    </span>
                    <h3 className="mt-3 text-lg font-normal leading-snug text-[#1F2125]">
                      {item.title}
                    </h3>
                    <p className="mt-2.5 text-[15px] font-normal leading-[1.7] text-[#475569]">
                      {item.description}
                    </p>
                  </div>
                  <div className="mt-6 border-t border-slate-100 pt-4 text-xs font-normal text-slate-500">
                    {item.meta}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 7. AN TOÀN Y TẾ & BRIGHT CORPORATE CTA BANNER */}
        <section
          id="an-toan"
          className="border-t border-[#C9DCFF] bg-gradient-to-r from-[#EEF4FF] via-[#F4F8FF] to-white py-16 text-[#1F2125] lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-8">
                <p className="text-sm font-normal text-[#1464F4]">
                  Tiêu chuẩn an toàn &amp; Bảo mật vận hành
                </p>
                <h2 className="mt-2.5 text-2xl font-normal leading-[1.24] tracking-[-0.015em] text-[#1F2125] sm:text-3xl [text-wrap:balance]">
                  Kiểm soát rủi ro y&nbsp;tế trước mỗi buổi tập và minh&nbsp;bạch&nbsp;hóa toàn bộ chu&nbsp;trình quản&nbsp;lý
                </h2>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-normal text-[#475569]">
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
                  href={Routes.login}
                >
                  Đăng nhập hệ thống
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
