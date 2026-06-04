import { createElement, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

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
        action: createElement(
          ToastAction,
          {
            altText: "Undo",
            onClick: () => {
              undone = true;
              clearTimeout(timeoutId);
              dismiss();
              undoFn()
                .then(() => {
                  toast({ title: "Action reversed" });
                })
                .catch(() => {
                  toast({ title: "Undo failed", variant: "destructive" });
                });
            },
          },
          "Undo"
        ),
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
