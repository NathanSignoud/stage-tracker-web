import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/actions/result";

/** Appelle une Server Action dans une transition et affiche le résultat en toast. */
export function useAction() {
  const [pending, startTransition] = useTransition();

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    options: { success?: string; onSuccess?: (data: T) => void; onError?: () => void } = {},
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (options.success) toast.success(options.success);
        options.onSuccess?.(result.data);
      } else {
        toast.error(result.error);
        options.onError?.();
      }
    });
  }

  return { pending, run };
}
