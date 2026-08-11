// src/services/calendar.js

import { isDemoActive } from "./resolver";
import * as DemoCalendar from "@/demo/calendar";
import * as FirebaseCalendar from "./firebase/calendar";

export const CalendarService = {
  getCalendarEvents: (categoryName, options) => {
    return isDemoActive()
      ? DemoCalendar.getCalendarEvents(categoryName, options)
      : FirebaseCalendar.getCalendarEvents(categoryName, options);
  },

  subscribeCalendarEvents: (categoryName, callback, options) => {
    return isDemoActive()
      ? DemoCalendar.subscribeCalendarEvents(categoryName, callback, options)
      : FirebaseCalendar.subscribeCalendarEvents(categoryName, callback, options);
  },

  updateRSVP: (eventId, studentName, response) => {
    return isDemoActive()
      ? DemoCalendar.updateRSVP(eventId, studentName, response)
      : FirebaseCalendar.updateRSVP(eventId, studentName, response);
  }
};
export default CalendarService;
