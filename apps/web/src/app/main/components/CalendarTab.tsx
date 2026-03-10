"use client";

import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import type { DatesSetArg } from "@fullcalendar/core";
import EventModal, { type EventFormData } from "./EventModal";
import { useEvents, type CalendarEventData } from "../../../hooks/useEvents";
import { useCoupleRoute } from "../../../hooks/useCoupleRoute";
import RouteSummary from "./RouteSummary";
import RouteDetail from "./RouteDetail";
import styles from "./CalendarTab.module.css";

type ModalView = "closed" | "list" | "create" | "edit";

interface CalendarTabProps {
  coupleId: string;
}

export default function CalendarTab({ coupleId }: CalendarTabProps) {
  const { events, setCurrentMonth, createEvent, updateEvent, deleteEvent } =
    useEvents(coupleId);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null);
  const [modalView, setModalView] = useState<ModalView>("closed");
  const [showRouteDetail, setShowRouteDetail] = useState(false);

  // 경로 분석: 기존 이벤트에 장소가 있을 때만 요청
  const hasLocation = Boolean(selectedEvent?.placeLat && selectedEvent?.placeLng);
  const routeEventId = modalView === "edit" && hasLocation ? selectedEvent?.id ?? null : null;
  const { route, loading: routeLoading, error: routeError, refresh: refreshRoute } =
    useCoupleRoute(routeEventId);

  // 선택된 날짜의 이벤트 목록
  const dayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((e) => e.appointmentAt?.startsWith(selectedDate));
  }, [events, selectedDate]);

  // FullCalendar 이벤트 데이터
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
    const dateStr = info.dateStr;
    setSelectedDate(dateStr);
    setShowRouteDetail(false);

    const eventsOnDay = events.filter((e) => e.appointmentAt?.startsWith(dateStr));

    if (eventsOnDay.length === 0) {
      setSelectedEvent(null);
      setModalView("create");
    } else if (eventsOnDay.length === 1) {
      setSelectedEvent(eventsOnDay[0]);
      setModalView("edit");
    } else {
      setSelectedEvent(null);
      setModalView("list");
    }
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
    setSelectedDate(null);
    setSelectedEvent(null);
    setModalView("closed");
    setShowRouteDetail(false);
  };

  const handleSelectEvent = (event: CalendarEventData) => {
    setSelectedEvent(event);
    setModalView("edit");
    setShowRouteDetail(false);
  };

  const handleNewEvent = () => {
    setSelectedEvent(null);
    setModalView("create");
  };

  const handleBackToList = () => {
    setSelectedEvent(null);
    setModalView("list");
    setShowRouteDetail(false);
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

  // 경로 섹션 렌더링
  let routeSection: ReactNode = null;
  if (modalView === "edit" && hasLocation) {
    if (routeLoading) {
      routeSection = <div className={styles.routeStatus}>경로 분석 중...</div>;
    } else if (routeError) {
      routeSection = <div className={styles.routeStatus}>{routeError}</div>;
    } else if (route && !showRouteDetail) {
      routeSection = (
        <RouteSummary
          route={route}
          onDetailClick={() => setShowRouteDetail(true)}
          onRefresh={refreshRoute}
        />
      );
    } else if (route && showRouteDetail) {
      routeSection = (
        <RouteDetail
          legs={route.myRoute.legs as Record<string, unknown>[]}
          meetupStationName={route.meetupStation?.name}
          partnerDepartureTime={route.partnerDepartureTime}
          onBack={() => setShowRouteDetail(false)}
        />
      );
    }
  }

  // 뒤로가기: 목록에서 온 경우 목록으로, 아니면 닫기
  const handleFormClose = dayEvents.length > 1 ? handleBackToList : handleClose;

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

      {/* 일정 목록 모달 (해당 날짜에 2개 이상 이벤트) */}
      {modalView === "list" && selectedDate && (
        <div className={styles.overlay} role="dialog" aria-modal="true" onClick={handleClose}>
          <div className={styles.dayModal} onClick={(e) => e.stopPropagation()}>
            <header className={styles.dayModalHeader}>
              <h3 className={styles.dayModalTitle}>{selectedDate}</h3>
              <button type="button" onClick={handleClose} className={styles.dayModalClose}>
                &times;
              </button>
            </header>
            <div className={styles.eventList}>
              {dayEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className={styles.eventCard}
                  onClick={() => handleSelectEvent(ev)}
                >
                  <span className={styles.eventCardTitle}>{ev.title}</span>
                  <span className={styles.eventCardMeta}>
                    {ev.appointmentAt &&
                      new Date(ev.appointmentAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    {ev.placeName && ` · ${ev.placeName}`}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" className={styles.newEventBtn} onClick={handleNewEvent}>
              + 새 일정 추가
            </button>
          </div>
        </div>
      )}

      {/* 일정 생성/수정 모달 */}
      {(modalView === "create" || modalView === "edit") && (
        <EventModal
          isOpen={true}
          selectedDate={selectedDate}
          existingEvent={selectedEvent ? toFormData(selectedEvent) : null}
          onClose={handleFormClose}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          routeSection={routeSection}
        />
      )}
    </div>
  );
}
