type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Field({ label, ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stable-ink">{label}</span>
      <input
        {...props}
        className="mt-2 h-11 w-full rounded-md border border-black/15 bg-white px-3 text-sm outline-none transition focus:border-stable-green focus:ring-2 focus:ring-stable-mint"
      />
    </label>
  );
}
