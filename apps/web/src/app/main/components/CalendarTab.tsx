"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import EventModal, { type EventFormData } from "./EventModal";
import styles from "./CalendarTab.module.css";

const seedEvents: Record<string, EventFormData> = {
  "2026-02-14": {
    title: "Anniversary",
    location: "",
    expected: "",
    details: "",
  },
  "2026-02-21": {
    title: "Date Night",
    location: "",
    expected: "",
    details: "",
  },
  "2026-02-27": {
    title: "Trip Planning",
    location: "",
    expected: "",
    details: "",
  },
};

export default function CalendarTab() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventsByDate, setEventsByDate] = useState<Record<string, EventFormData>>(
    () => seedEvents,
  );

  const events = useMemo(
    () =>
      Object.entries(eventsByDate).map(([date, event]) => ({
        title: event.title,
        date,
      })),
    [eventsByDate],
  );

  const selectedEvent = selectedDate ? eventsByDate[selectedDate] ?? null : null;

  const handleDateClick = (info: DateClickArg) => {
    setSelectedDate(info.dateStr);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
  };

  const handleCreate = (date: string, event: EventFormData) => {
    setEventsByDate((prev) => ({ ...prev, [date]: event }));
    setIsModalOpen(false);
    setSelectedDate(null);
  };

  const handleUpdate = (date: string, event: EventFormData) => {
    setEventsByDate((prev) => ({ ...prev, [date]: event }));
    setIsModalOpen(false);
    setSelectedDate(null);
  };

  const handleDelete = (date: string) => {
    setEventsByDate((prev) => {
      const { [date]: _, ...rest } = prev;
      return rest;
    });
    setIsModalOpen(false);
    setSelectedDate(null);
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
        existingEvent={selectedEvent}
        onClose={handleClose}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
