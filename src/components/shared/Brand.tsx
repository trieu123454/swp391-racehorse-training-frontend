import Image from "next/image";

export function Brand({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <div className="inline-flex min-w-0 max-w-full items-center">
      <span
        className={`relative block shrink-0 ${compact ? "h-14 sm:h-16 lg:h-[68px]" : "h-16 sm:h-[72px]"}`}
        style={{ aspectRatio: "1983 / 793" }}
      >
        <Image
          alt="Equine Racehorse System"
          className={`object-contain ${light ? "brightness-0 invert" : "mix-blend-multiply [filter:contrast(1.06)_brightness(1.03)]"}`}
          fill
          priority
          sizes="180px"
          src="/assets/aistudio/image_f48a425a.png"
        />
      </span>
    </div>
  );
}
