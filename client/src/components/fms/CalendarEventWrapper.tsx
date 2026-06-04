import { useRef, useState } from "react";
import { CalendarContextMenu } from "./CalendarContextMenu";

export function CalendarEventWrapper({ event }: { event: any }) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setContextMenu({ x: touch.clientX, y: touch.clientY });
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const isJob = event.resource?.calendarType === "job";

  return (
    <>
      <div
        className="rbc-event-content truncate"
        style={{ userSelect: "none", touchAction: "none", width: "100%" }}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        title={event.title}
      >
        {event.title}
      </div>
      {contextMenu && (
        <CalendarContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          event={event.resource}
          eventType={isJob ? "job" : "booking"}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
