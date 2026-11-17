import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface ModalDialogProps {
  open: boolean;
  title: string;
  subtitle?: string | undefined;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}

export function ModalDialog({
  open,
  title,
  subtitle,
  onClose,
  children,
  maxWidth = "620px",
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Light-dismiss fallback for browsers without <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);

    if ("closedBy" in HTMLDialogElement.prototype) {
      return () => dialog.removeEventListener("close", handleClose);
    }

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    let pressedOutside = false;
    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) dialog.close();
    };

    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);

    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="rt-dialog"
      style={{ inlineSize: `min(${maxWidth}, calc(100dvw - 28px))` }}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#e4e7da] pb-3 mb-4">
        <div>
          <h2 id={titleId} className="font-serif-display text-2xl font-medium m-0">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-[#697466] mt-1 mb-0">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={`Close ${title}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7ebdd] text-[#263328] hover:bg-[#d8dfcc] shrink-0"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
