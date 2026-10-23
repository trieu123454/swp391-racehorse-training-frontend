import type React from "react";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: React.ReactNode;
  error?: string;
};

export function Field({ label, icon, error, className = "", ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <span className="relative block">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          {...props}
          className={`field-control w-full ${icon ? "pl-11" : "px-3"} ${error ? "!border-rose-300 focus:!border-rose-500" : ""} ${className}`}
        />
      </span>
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}
