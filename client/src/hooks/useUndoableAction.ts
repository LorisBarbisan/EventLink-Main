import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export function useUndoableAction() {
  const { toast } = useToast();

  const executeWithUndo = useCallback(
    (actionFn: () => Promise<void>, undoFn: () => Promise<void>, label: string) => {
      let undone = false;
      let timeoutId: ReturnType<typeof setTimeout>;

      const { dismiss } = toast({
        title: label,
        description: "Click Undo to reverse this action.",
        duration: 5500,
        action: (
          <button
            onClick={() => {
              undone = true;
              clearTimeout(timeoutId);
              dismiss();
              undoFn().then(() => {
                toast({ title: "Action reversed" });
              }).catch(() => {
                toast({ title: "Undo failed", variant: "destructive" });
              });
            }}
            style={{ fontWeight: 600, color: "#E8610A", padding: "4px 8px" }}
          >
            Undo
          </button>
        ) as any,
      });

      timeoutId = setTimeout(async () => {
        if (!undone) {
          try {
            await actionFn();
          } catch {
            toast({ title: "Action failed", variant: "destructive" });
          }
        }
      }, 5000);
    },
    [toast]
  );

  return { executeWithUndo };
}
