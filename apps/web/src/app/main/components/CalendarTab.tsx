"use client";

import { useCallback, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import type { DatesSetArg } from "@fullcalendar/core";
import EventModal, { type EventFormData } from "./EventModal";
import { useEvents, type CalendarEventData } from "../../../hooks/useEvents";
import styles from "./CalendarTab.module.css";

// TODO: Replace with actual auth context
const COUPLE_ID = "seed_couple_1_id";
const USER_ID = "seed_user_1_id";

export default function CalendarTab() {
  const { events, setCurrentMonth, createEvent, updateEvent, deleteEvent } =
    useEvents(COUPLE_ID, USER_ID);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] =
    useState<CalendarEventData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const calendarEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.appointmentAt ? e.appointmentAt.split("T")[0] : undefined,
      })),
    [events],
  );

  const handleDateClick = (info: DateClickArg) => {
    setSelectedDate(info.dateStr);
    const existing = events.find((e) =>
      e.appointmentAt?.startsWith(info.dateStr),
    );
    setSelectedEvent(existing ?? null);
    setIsModalOpen(true);
  };

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      const mid = new Date((arg.start.getTime() + arg.end.getTime()) / 2);
      const month = `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, "0")}`;
      setCurrentMonth(month);
    },
    [setCurrentMonth],
  );

  const handleClose = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
    setSelectedEvent(null);
  };

  const toFormData = (e: CalendarEventData): EventFormData => ({
    title: e.title,
    appointmentAt: e.appointmentAt ? e.appointmentAt.slice(0, 16) : "",
    placeName: e.placeName ?? "",
    placeAddress: e.placeAddress ?? "",
    placeLat: e.placeLat,
    placeLng: e.placeLng,
    detail: e.detail ?? "",
  });

  const handleCreate = async (_date: string, form: EventFormData) => {
    try {
      await createEvent({
        title: form.title,
        appointmentAt: form.appointmentAt
          ? new Date(form.appointmentAt).toISOString()
          : undefined,
        placeName: form.placeName || undefined,
        placeAddress: form.placeAddress || undefined,
        placeLat: form.placeLat ?? undefined,
        placeLng: form.placeLng ?? undefined,
        detail: form.detail || undefined,
      });
    } catch (err) {
      console.error(err);
    }
    handleClose();
  };

  const handleUpdate = async (_date: string, form: EventFormData) => {
    if (!selectedEvent) return;
    try {
      await updateEvent(selectedEvent.id, {
        title: form.title,
        appointmentAt: form.appointmentAt
          ? new Date(form.appointmentAt).toISOString()
          : null,
        placeName: form.placeName || null,
        placeAddress: form.placeAddress || null,
        placeLat: form.placeLat,
        placeLng: form.placeLng,
        detail: form.detail || null,
      });
    } catch (err) {
      console.error(err);
    }
    handleClose();
  };

  const handleDelete = async (_date: string) => {
    if (!selectedEvent) return;
    try {
      await deleteEvent(selectedEvent.id);
    } catch (err) {
      console.error(err);
    }
    handleClose();
  };

  return (
    <div className={styles.calendarTab}>
      <div className={styles.calendarCard}>
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: "prev,next", center: "title", right: "" }}
          events={calendarEvents}
          dateClick={handleDateClick}
          datesSet={handleDatesSet}
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
        existingEvent={selectedEvent ? toFormData(selectedEvent) : null}
        onClose={handleClose}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
