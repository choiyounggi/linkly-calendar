"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import EventModal from "./EventModal";
import styles from "./CalendarTab.module.css";

const seedEvents = [
  { title: "Anniversary", date: "2026-02-14" },
  { title: "Date Night", date: "2026-02-21" },
  { title: "Trip Planning", date: "2026-02-27" },
];

export default function CalendarTab() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const events = useMemo(() => seedEvents, []);

  const handleDateClick = (info: DateClickArg) => {
    setSelectedDate(info.dateStr);
    setIsModalOpen(true);
  };

  return (
    <div className={styles.calendarTab}>
      <div className={styles.calendarCard}>
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: "prev,next", center: "title", right: "" }}
          events={events}
          dateClick={handleDateClick}
          height="auto"
          dayMaxEventRows={2}
          dayCellClassNames={(arg) =>
            selectedDate === arg.dateStr ? [styles.selectedDay] : []
          }
        />
      </div>
      <EventModal
        isOpen={isModalOpen}
        selectedDate={selectedDate}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
