import Image from "next/image";
import { Activity, BriefcaseMedical, Sparkles } from "lucide-react";

export function AuthVisual({ mode }: { mode: "login" | "register" }) {
  return (
    <aside className="relative hidden min-h-[720px] overflow-hidden bg-equine-navy text-white lg:block">
      <Image
        alt="Chiến mã trong chuồng ngựa cao cấp"
        className="object-cover"
        fill
        priority
        sizes="(max-width: 1200px) 42vw, 650px"
        src="/images/stable-horse.png"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,25,44,0.2),rgba(11,25,44,0.92))]" />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-10">
        <span className="rounded-full border border-equine-gold/40 bg-equine-navy/65 px-4 py-2 text-[10px] font-bold uppercase text-equine-champagne backdrop-blur">
          <Sparkles className="mr-2 inline" size={14} />
          Syndicate Verified
        </span>
        <span className="text-[10px] font-bold uppercase text-white/60">
          Est. 1892
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-10">
        <p className="eyebrow text-equine-champagne">Đặc quyền hội viên</p>
        <h2 className="mt-3 max-w-lg font-serif text-4xl font-semibold leading-tight">
          {mode === "login" ? (
            "Chiến mã huyền thoại được tôi luyện từ kỷ luật."
          ) : (
            <>
              Đồng hành cùng những{" "}
              <em className="text-equine-champagne">chiến mã vô địch</em>
            </>
          )}
        </h2>
        {mode === "register" ? (
          <div className="mt-8 space-y-5 text-sm text-white/75">
            <p className="flex gap-3">
              <Activity className="shrink-0 text-equine-champagne" size={20} />
              <span>
                <strong className="block text-white">
                  Theo dõi chỉ số thể lực realtime
                </strong>
                Telemetry nhịp tim, sải chân và tốc độ chính xác.
              </span>
            </p>
            <p className="flex gap-3">
              <BriefcaseMedical
                className="shrink-0 text-equine-champagne"
                size={20}
              />
              <span>
                <strong className="block text-white">
                  Hồ sơ y tế minh bạch
                </strong>
                Phác đồ, tiêm chủng và lịch sử điều trị tập trung.
              </span>
            </p>
          </div>
        ) : (
          <div className="mt-8 border-l-2 border-equine-gold bg-equine-navy/70 p-6 backdrop-blur">
            <p className="font-serif text-xl italic leading-8">
              “Chiến mã huyền thoại được tôi luyện từ kỷ luật và khoa học huấn
              luyện chính xác.”
            </p>
            <p className="mt-4 text-xs text-equine-champagne">
              Hội Đồng Huấn Luyện &amp; Quản Trị Huyết Thống
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
