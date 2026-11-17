import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ToastItem {
  id: number;
  message: string;
  tone: "info" | "error";
}

interface ToastContextValue {
  notify: (message: string, tone?: "info" | "error") => void;
}

const ToastContext = createContext<ToastContextValue>({
  notify: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

function ToastPopover({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current as
      (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el) return;
    el.setAttribute("popover", "manual");
    try {
      el.showPopover?.();
    } catch {
      el.classList.add(":popover-open");
    }
    const timer = setTimeout(() => onDismiss(item.id), 4000);
    return () => {
      clearTimeout(timer);
      try {
        el.hidePopover?.();
      } catch {
        el.classList.remove(":popover-open");
      }
    };
  }, [item.id, onDismiss]);

  return (
    <div
      ref={ref}
      className="rt-toast-item"
      style={item.tone === "error" ? { background: "#7c2e26", borderColor: "#b45349" } : undefined}
    >
      <span className="flex-1">{item.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!Object.hasOwn(HTMLElement.prototype, "popover")) {
      // Progressive enhancement fallback already handled via classList in ToastPopover
    }
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, tone: "info" | "error" = "info") => {
    const id = nextIdRef.current++;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setAnnouncement(message);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>
      <div className="rt-toast-region" role="region" aria-label="Notifications">
        {toasts.map((item) => (
          <ToastPopover key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
