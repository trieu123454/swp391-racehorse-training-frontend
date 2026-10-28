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
      <Image
        alt="Equine Racehorse System"
        className={`w-auto shrink-0 object-contain ${
          compact ? "h-14 sm:h-16 lg:h-[68px]" : "h-16 sm:h-[72px]"
        } ${
          light
            ? "brightness-0 invert"
            : "mix-blend-multiply [filter:contrast(1.06)_brightness(1.03)]"
        }`}
        height={compact ? 68 : 72}
        priority
        src="/assets/aistudio/image_f48a425a.png"
        width={compact ? 180 : 196}
      />
    </div>
  );
}
