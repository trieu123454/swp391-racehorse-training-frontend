"use client";

import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "@/lib/api";
import type { RoleName } from "@/lib/types";

type GoogleCredentialResponse = { credential: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }): void;
          renderButton(
            element: HTMLElement,
            options: Record<string, string | number>,
          ): void;
        };
      };
    };
  }
}

export function GoogleAuthButton({
  roleName,
  onSuccess,
  onError,
  label,
}: {
  roleName?: RoleName;
  onSuccess: (response: Awaited<ReturnType<typeof loginWithGoogle>>) => void;
  onError: (message: string) => void;
  label: string;
}) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setConfigured(false);
      return;
    }

    let active = true;
    const failed = () => {
      if (active) setConfigured(false);
    };
    const render = () => {
      if (!active || !window.google || !buttonRef.current) return;
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            const response = await loginWithGoogle(credential, roleName);
            if (active) onSuccess(response);
          } catch (error) {
            if (active)
              onError(
                error instanceof Error
                  ? error.message
                  : "Không thể đăng nhập bằng Google",
              );
          }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: label,
        shape: "rectangular",
        width: Math.min(buttonRef.current.clientWidth, 400),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      if (window.google) render();
      else existing.addEventListener("load", render, { once: true });
      existing.addEventListener("error", failed);
      return () => {
        active = false;
        existing.removeEventListener("load", render);
        existing.removeEventListener("error", failed);
      };
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", render);
    script.addEventListener("error", failed);
    document.head.appendChild(script);
    return () => {
      active = false;
      script.removeEventListener("load", render);
      script.removeEventListener("error", failed);
    };
  }, [label, onError, onSuccess, roleName]);

  if (!configured)
    return (
      <button
        className="h-12 w-full rounded-md bg-equine-mist text-sm font-semibold text-equine-ink"
        onClick={() =>
          onError(
            "Đăng nhập Google hiện chưa khả dụng. Vui lòng dùng email hoặc thử lại sau.",
          )
        }
        type="button"
      >
        Đăng nhập bằng Google
      </button>
    );
  return (
    <div
      aria-label="Đăng nhập bằng Google"
      className="flex min-h-12 w-full items-center justify-center overflow-hidden rounded-md bg-equine-mist"
      ref={buttonRef}
    />
  );
}
