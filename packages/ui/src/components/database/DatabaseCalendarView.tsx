import { useState, useCallback, useMemo } from 'react';
import type { DatabaseRow } from '@cept/core';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';

export interface DatabaseCalendarViewProps {
  properties: SchemaProperty[];
  rows: DatabaseRow[];
  dateProperty: string;
  year?: number;
  month?: number;
  onRowClick?: (rowId: string) => void;
  onAddRow?: (date: string) => void;
  onMonthChange?: (year: number, month: number) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getTitleValue(row: DatabaseRow, properties: SchemaProperty[]): string {
  const titleProp = properties.find((p) => p.definition.type === 'title');
  if (!titleProp) return row.id;
  const val = row.properties[titleProp.name];
  return val != null ? String(val) : '';
}

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateValue(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return d;
}

interface CalendarDay {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  rows: DatabaseRow[];
}

function buildCalendarGrid(
  year: number,
  month: number,
  rowsByDate: Map<string, DatabaseRow[]>,
  today: Date,
): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = getDateKey(today);

  const days: CalendarDay[] = [];

  // Previous month filler days
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthDays - i);
    const dateKey = getDateKey(date);
    days.push({
      date,
      dateKey,
      isCurrentMonth: false,
      isToday: dateKey === todayKey,
      rows: rowsByDate.get(dateKey) ?? [],
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dateKey = getDateKey(date);
    days.push({
      date,
      dateKey,
      isCurrentMonth: true,
      isToday: dateKey === todayKey,
      rows: rowsByDate.get(dateKey) ?? [],
    });
  }

  // Next month filler days (fill to complete last row)
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      const dateKey = getDateKey(date);
      days.push({
        date,
        dateKey,
        isCurrentMonth: false,
        isToday: dateKey === todayKey,
        rows: rowsByDate.get(dateKey) ?? [],
      });
    }
  }

  return days;
}

export function DatabaseCalendarView({
  properties,
  rows,
  dateProperty,
  year: initialYear,
  month: initialMonth,
  onRowClick,
  onAddRow,
  onMonthChange,
}: DatabaseCalendarViewProps) {
  const now = new Date();
  const [year, setYear] = useState(initialYear ?? now.getFullYear());
  const [month, setMonth] = useState(initialMonth ?? now.getMonth());

  const rowsByDate = useMemo(() => {
    const map = new Map<string, DatabaseRow[]>();
    for (const row of rows) {
      const dateVal = parseDateValue(row.properties[dateProperty]);
      if (!dateVal) continue;
      const key = getDateKey(dateVal);
      const existing = map.get(key);
      if (existing) {
        existing.push(row);
      } else {
        map.set(key, [row]);
      }
    }
    return map;
  }, [rows, dateProperty]);

  const calendarDays = useMemo(
    () => buildCalendarGrid(year, month, rowsByDate, now),
    [year, month, rowsByDate],
  );

  const handlePrevMonth = useCallback(() => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    setMonth(newMonth);
    setYear(newYear);
    onMonthChange?.(newYear, newMonth);
  }, [month, year, onMonthChange]);

  const handleNextMonth = useCallback(() => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setMonth(newMonth);
    setYear(newYear);
    onMonthChange?.(newYear, newMonth);
  }, [month, year, onMonthChange]);

  const handleToday = useCallback(() => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
    onMonthChange?.(t.getFullYear(), t.getMonth());
  }, [onMonthChange]);

  return (
    <div className="cept-calendar-view" data-testid="calendar-view">
      <div className="cept-calendar-toolbar" data-testid="calendar-toolbar">
        <button
          className="cept-calendar-nav-btn"
          onClick={handlePrevMonth}
          data-testid="calendar-prev"
        >
          {'<'}
        </button>
        <span className="cept-calendar-title" data-testid="calendar-title">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          className="cept-calendar-nav-btn"
          onClick={handleNextMonth}
          data-testid="calendar-next"
        >
          {'>'}
        </button>
        <button
          className="cept-calendar-today-btn"
          onClick={handleToday}
          data-testid="calendar-today"
        >
          Today
        </button>
      </div>

      <div className="cept-calendar-grid" data-testid="calendar-grid">
        <div className="cept-calendar-weekdays">
          {WEEKDAYS.map((day) => (
            <div key={day} className="cept-calendar-weekday" data-testid={`calendar-weekday-${day}`}>
              {day}
            </div>
          ))}
        </div>

        <div className="cept-calendar-days">
          {calendarDays.map((day) => (
            <div
              key={day.dateKey}
              className={[
                'cept-calendar-day',
                day.isCurrentMonth ? 'is-current-month' : 'is-other-month',
                day.isToday ? 'is-today' : '',
              ].filter(Boolean).join(' ')}
              data-testid={`calendar-day-${day.dateKey}`}
            >
              <div className="cept-calendar-day-number">
                {day.date.getDate()}
              </div>
              <div className="cept-calendar-day-events">
                {day.rows.map((row) => (
                  <div
                    key={row.id}
                    className="cept-calendar-event"
                    onClick={(e) => { e.stopPropagation(); onRowClick?.(row.id); }}
                    data-testid={`calendar-event-${row.id}`}
                  >
                    {getTitleValue(row, properties)}
                  </div>
                ))}
              </div>
              {onAddRow && day.isCurrentMonth && (
                <button
                  className="cept-calendar-add-event"
                  onClick={() => onAddRow(day.dateKey)}
                  data-testid={`calendar-add-${day.dateKey}`}
                >
                  +
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
