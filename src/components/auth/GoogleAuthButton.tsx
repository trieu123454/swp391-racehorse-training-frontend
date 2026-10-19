"use client";

import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "@/api/client";
import type { RoleName } from "@/lib/types";

type GoogleCredentialResponse = { credential: string };

declare global {
  interface Window {
    equineGoogleIdentity?: {
      clientId?: string;
      callback?: (response: GoogleCredentialResponse) => void;
    };
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
  const callbacks = useRef({ roleName, onSuccess, onError });

  useEffect(() => {
    callbacks.current = { roleName, onSuccess, onError };
  }, [roleName, onSuccess, onError]);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setConfigured(false);
      return;
    }

    let active = true;
    let submitting = false;
    const identity = window.equineGoogleIdentity ??= {};
    const handleCredential = async ({ credential }: GoogleCredentialResponse) => {
      if (!active || submitting) return;
      submitting = true;
      const current = callbacks.current;
      try {
        const response = await loginWithGoogle(credential, current.roleName);
        if (active) current.onSuccess(response);
      } catch (error) {
        if (active) current.onError(error instanceof Error ? error.message : "Không thể đăng nhập bằng Google");
      } finally {
        submitting = false;
      }
    };
    identity.callback = handleCredential;
    const deactivate = () => {
      active = false;
      if (identity.callback === handleCredential) identity.callback = undefined;
    };
    const failed = () => {
      if (active) setConfigured(false);
    };
    const render = () => {
      if (!active || !window.google || !buttonRef.current) return;
      buttonRef.current.innerHTML = "";
      if (identity.clientId !== clientId) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => window.equineGoogleIdentity?.callback?.(response),
        });
        identity.clientId = clientId;
      }
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
        deactivate();
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
      deactivate();
      script.removeEventListener("load", render);
      script.removeEventListener("error", failed);
    };
  }, [label]);

  if (!configured)
    return (
      <button
        className="auth-google-fallback w-full text-sm font-semibold"
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
      className="auth-google-button flex w-full items-center justify-center"
      ref={buttonRef}
    />
  );
}
