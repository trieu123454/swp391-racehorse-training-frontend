import Image from "next/image";

export function Brand({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-3">
      <Image
        alt=""
        aria-hidden="true"
        className="shrink-0 rounded-md bg-[#fff2e9]"
        height={compact ? 44 : 58}
        src="/img/equine-racehorse-mark.svg"
        width={compact ? 44 : 58}
      />
      <div className="min-w-0">
        <p
          className={`truncate font-sans font-bold tracking-[0.12em] ${compact ? "text-sm sm:text-base" : "text-lg sm:text-xl"} ${light ? "text-equine-champagne" : "text-[#1e293b]"}`}
        >
          EQUINE
        </p>
        <p
          className={`truncate font-bold uppercase ${compact ? "text-[7px] sm:text-[8px]" : "text-[9px]"} ${light ? "text-white/55" : "text-[#d95d1e]"}`}
          style={{ letterSpacing: "0.1em" }}
        >
          Racehorse System
        </p>
      </div>
    </div>
  );
}
