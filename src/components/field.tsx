import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  className,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const NONE = "__none__";

/** Select alimenté par un dictionnaire valeur → libellé, avec option « — » facultative. */
export function OptionSelect<V extends string>({
  id,
  value,
  onChange,
  options,
  allowEmpty = false,
  placeholder = "—",
  className,
}: {
  id?: string;
  value: V | null;
  onChange: (value: V | null) => void;
  options: Record<V, string> | readonly (readonly [V, string])[];
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const entries = (Array.isArray(options) ? options : Object.entries(options)) as [V, string][];
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : (v as V))}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value={NONE}>{placeholder}</SelectItem>}
        {entries.map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
