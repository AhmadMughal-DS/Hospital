import { useEffect, useRef, useState } from "react";

/**
 * useAppointmentAlerts
 *
 * - Requests browser notification permission on mount
 * - Every 30 seconds, checks all TeleHealth appointments
 * - Fires a browser notification when appointment is 5 min away
 * - Returns a helper `getCallStatus(apt)` to compute button state
 *
 * @param {Array}  appointments  - list of appointment objects from backend
 * @param {Function} onJoinCall  - called with apt when user clicks notification
 */
export function useAppointmentAlerts(appointments, onJoinCall) {
  const notifiedRef = useRef(new Set()); // track which apt IDs already notified

  // Request notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Polling loop — runs every 30 seconds
  useEffect(() => {
    const check = () => {
      const now = new Date();

      appointments.forEach(apt => {
        if (apt.appointment_type !== "TELE_HEALTH") return;
        if (!apt.tele_room_id) return;
        if (!apt.appointment_date || !apt.appointment_time) return;
        if (apt.status === "CANCELLED" || apt.status === "COMPLETED") return;

        const aptDate = parseAptDate(apt.appointment_date, apt.appointment_time);
        const minsUntil = (aptDate - now) / 60000;

        // Fire notification when 5 min window: between 5.5 and 4.5 min away
        if (minsUntil <= 5.5 && minsUntil > 0 && !notifiedRef.current.has(apt.id)) {
          notifiedRef.current.add(apt.id);
          fireNotification(apt, onJoinCall);
        }
      });
    };

    check(); // run immediately
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [appointments]);
}

/**
 * getCallStatus(apt) → object describing the current button state
 *
 * Returns:
 *   { state: "upcoming" | "soon" | "now" | "ended" | "na",
 *     label: string,
 *     minsUntil: number,
 *     canJoin: boolean }
 */
export function getCallStatus(apt) {
  if (apt.appointment_type !== "TELE_HEALTH" || !apt.tele_room_id) {
    return { state: "na", label: "", minsUntil: null, canJoin: false };
  }

  const now = new Date();
  const aptDate = parseAptDate(apt.appointment_date, apt.appointment_time);
  const minsUntil = (aptDate - now) / 60000;

  if (minsUntil > 30) {
    const h = Math.floor(minsUntil / 60);
    const m = Math.round(minsUntil % 60);
    const label = h > 0 ? `In ${h}h ${m}m` : `In ${Math.round(minsUntil)}m`;
    return { state: "upcoming", label, minsUntil, canJoin: false };
  }

  if (minsUntil > 0) {
    const m = Math.ceil(minsUntil);
    return {
      state: "soon",
      label: minsUntil <= 5 ? `Starts in ${m}m` : `Join soon (${m}m)`,
      minsUntil,
      canJoin: true,
    };
  }

  // Past start time — allow joining up to 60 minutes after
  if (minsUntil > -60) {
    return { state: "now", label: "Join Now!", minsUntil, canJoin: true };
  }

  return { state: "ended", label: "Ended", minsUntil, canJoin: false };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseAptDate(dateStr, timeStr) {
  // dateStr: "2026-04-29", timeStr: "10:30:00" or "10:30"
  const t = timeStr?.slice(0, 5) || "00:00";
  return new Date(`${dateStr}T${t}:00`);
}

function fireNotification(apt, onJoinCall) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const doctorName = apt.doctor_detail?.full_name || "your doctor";
  const time = apt.appointment_time?.slice(0, 5);

  const n = new Notification("📹 TeleHealth Appointment Starting Soon!", {
    body: `Your call with ${doctorName} starts in 5 minutes (${time}). Click to join.`,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `medicore-apt-${apt.id}`, // prevents duplicate notifications
    requireInteraction: true,     // stays until user dismisses
  });

  n.onclick = () => {
    window.focus();
    n.close();
    if (onJoinCall) onJoinCall(apt);
  };
}
