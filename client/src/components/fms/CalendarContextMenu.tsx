import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

interface Props {
  x: number;
  y: number;
  event: any;
  eventType: "booking" | "job";
  onClose: () => void;
}

export function CalendarContextMenu({ x, y, event, eventType, onClose }: Props) {
  const [, setLocation] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const items: { label: string; action: () => void; danger?: boolean }[] = [];

  if (eventType === "booking") {
    items.push(
      {
        label: "View Details",
        action: () => {
          const clickEvent = new CustomEvent("calendar:open-detail", { detail: event });
          window.dispatchEvent(clickEvent);
          onClose();
        },
      },
      {
        label: "Go to Bookings Tab",
        action: () => {
          setLocation("/employer?tab=bookings");
          onClose();
        },
      },
      {
        label: "Cancel Booking",
        danger: true,
        action: () => {
          const clickEvent = new CustomEvent("calendar:cancel-booking", { detail: event });
          window.dispatchEvent(clickEvent);
          onClose();
        },
      }
    );
  } else {
    items.push(
      {
        label: "View Details",
        action: () => {
          const clickEvent = new CustomEvent("calendar:open-detail", { detail: event });
          window.dispatchEvent(clickEvent);
          onClose();
        },
      },
      {
        label: "Go to Jobs Tab",
        action: () => {
          setLocation("/employer?tab=jobs");
          onClose();
        },
      }
    );
  }

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    left: x,
    top: y,
    zIndex: 9999,
    background: "var(--background, #fff)",
    border: "1px solid var(--border, #e5e7eb)",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    minWidth: "180px",
    overflow: "hidden",
  };

  return (
    <div ref={menuRef} style={menuStyle}>
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          style={{
            display: "block",
            width: "100%",
            padding: "10px 14px",
            textAlign: "left",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            color: item.danger ? "#ef4444" : "var(--foreground, inherit)",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = "var(--accent, #f4f4f5)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = "transparent";
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
