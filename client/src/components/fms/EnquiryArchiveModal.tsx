import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enquiryTitle: string;
  onConfirm: () => void;
  isPending: boolean;
}

export function EnquiryArchiveModal({
  open,
  onOpenChange,
  enquiryTitle,
  onConfirm,
  isPending,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-muted-foreground" />
            Archive enquiry?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{enquiryTitle}</span>{" "}
            will be moved out of your active list into the archive. You can
            reactivate it at any time from the Archived view.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-gray-700 hover:bg-gray-800 text-white"
          >
            {isPending ? "Archiving…" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
