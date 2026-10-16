import Image from "next/image";

export function AuthVisual() {
  return (
    <aside className="auth-visual">
      <div className="auth-visual-image">
        <Image
          alt="Ngựa đua được chăm sóc tại chuồng trại"
          className="object-cover"
          fill
          quality={80}
          sizes="(max-width: 1200px) 42vw, 650px"
          src="/img/stable-horse.webp"
        />
      </div>
    </aside>
  );
}
