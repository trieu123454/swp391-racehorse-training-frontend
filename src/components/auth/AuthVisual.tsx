import Image from "next/image";

export function AuthVisual() {
  return (
    <aside className="auth-visual">
      <div className="auth-visual-image">
        <Image
          alt="Ngựa đua được chăm sóc tại chuồng trại"
          className="object-cover object-[center_22%]"
          fill
          priority
          quality={95}
          sizes="(max-width: 1200px) 48vw, 650px"
          src="/img/stable-horse.webp"
        />
      </div>
    </aside>
  );
}
