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
        alt="Racehorse System"
        aria-hidden="true"
        className="shrink-0"
        height={compact ? 38 : 48}
        src={light ? "/img/equine-racehorse-mark-white.svg" : "/img/equine-racehorse-mark.svg"}
        width={compact ? 38 : 48}
      />
      <div className="min-w-0">
        <p
          className={`truncate font-sans font-bold tracking-[0.12em] ${compact ? "text-sm sm:text-base" : "text-lg sm:text-xl"} ${light ? "text-white" : "text-[#101732]"}`}
        >
          EQUINE
        </p>
        <p
          className={`truncate font-bold uppercase ${compact ? "text-[8px] sm:text-[9px]" : "text-[10px]"} ${light ? "text-cyan-200" : "text-[#0099CF]"}`}
          style={{ letterSpacing: "0.1em" }}
        >
          Racehorse System
        </p>
      </div>
    </div>
  );
}
