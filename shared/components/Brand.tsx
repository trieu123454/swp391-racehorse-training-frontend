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
        alt="Royal Equine"
        className="shrink-0 rounded-sm"
        height={compact ? 44 : 58}
        src="/images/equine-logo.webp"
        width={compact ? 44 : 58}
      />
      <div className="min-w-0">
        <p
          className={`truncate font-sans font-semibold ${compact ? "text-sm sm:text-base" : "text-lg sm:text-xl"} ${light ? "text-equine-champagne" : "text-equine-navy"}`}
        >
          EQUINE SOVEREIGN
        </p>
        {!compact ? (
          <p
            className={`truncate text-[9px] font-bold uppercase ${light ? "text-white/55" : "text-equine-gold"}`}
            style={{ letterSpacing: "0.1em" }}
          >
            Thoroughbred Management
          </p>
        ) : null}
      </div>
    </div>
  );
}
