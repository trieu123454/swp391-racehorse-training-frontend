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
        className="rounded-sm"
        height={compact ? 34 : 46}
        src="/images/equine-logo.png"
        width={compact ? 34 : 46}
      />
      <div className="min-w-0">
        <p
          className={`truncate font-serif font-semibold ${compact ? "text-sm sm:text-base" : "text-lg sm:text-xl"} ${light ? "text-equine-champagne" : "text-equine-navy"}`}
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
