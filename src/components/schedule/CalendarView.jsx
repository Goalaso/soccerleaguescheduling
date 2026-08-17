import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatMatchDate, isMatchOverdue, parseMatchDate } from '../../utils/season';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function shortName(name) {
  return name.replace('Team ', '');
}

function statusOf(match) {
  if (match.status === 'played') return 'recorded';
  return isMatchOverdue(match) ? 'needs-score' : 'upcoming';
}

function CalendarView({ matches, showAll, filterTeamId, onSelectMatch }) {
  const visibleMatches = useMemo(
    () =>
      showAll
        ? matches
        : matches.filter((m) => m.home.id === filterTeamId || m.away.id === filterTeamId),
    [matches, showAll, filterTeamId]
  );

  const sorted = useMemo(
    () => [...visibleMatches].sort((a, b) => parseMatchDate(a.matchDate) - parseMatchDate(b.matchDate)),
    [visibleMatches]
  );
  const needsScore = sorted.filter((m) => statusOf(m) === 'needs-score');
  const upcoming = sorted.filter((m) => statusOf(m) === 'upcoming');

  const [monthStart, setMonthStart] = useState(() => {
    const first = needsScore[0] || upcoming[0] || sorted[0];
    const d = first ? parseMatchDate(first.matchDate) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // The useState initializer above only ever runs once, at mount — if this
  // component mounts before its filtered match set is actually populated
  // (e.g. a slower-to-resolve profile fetch upstream), it locks in "today's
  // month" and never recovers even once the real data arrives a moment
  // later. Catch that specific empty -> populated transition and jump to
  // the right month then, without fighting a user who's already navigated
  // manually during normal use (this only fires on that one transition).
  const hadMatches = useRef(sorted.length > 0);
  useEffect(() => {
    const hasMatches = sorted.length > 0;
    if (!hadMatches.current && hasMatches) {
      const first = needsScore[0] || upcoming[0] || sorted[0];
      const d = parseMatchDate(first.matchDate);
      setMonthStart(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    hadMatches.current = hasMatches;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted]);

  const matchesByDay = useMemo(() => {
    const map = {};
    sorted.forEach((m) => {
      const d = parseMatchDate(m.matchDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map[key] ||= []).push(m);
    });
    return map;
  }, [sorted]);

  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const goToMonth = (delta) => setMonthStart(new Date(year, month + delta, 1));

  const today = new Date();
  const isToday = (day) =>
    day != null &&
    year === today.getFullYear() &&
    month === today.getMonth() &&
    day === today.getDate();

  return (
    <div className="schedule-layout">
      <div className="panel schedule-sidebar">
        <span className="option-label">Legend</span>
        <div className="calendar-legend">
          <span>
            <span className="legend-dot legend-dot-recorded" /> Score recorded
          </span>
          <span>
            <span className="legend-dot legend-dot-needs" /> Needs score entry
          </span>
          <span>
            <span className="legend-dot legend-dot-upcoming" /> Upcoming
          </span>
        </div>

        {sorted.length === 0 && (
          <p className="empty-state-subtitle schedule-section-label">
            No games found for your team yet.
          </p>
        )}

        {needsScore.length > 0 && (
          <>
            <span className="option-label schedule-section-label">Needs Score</span>
            {needsScore.map((m) => (
              <button
                key={m.id}
                className="match-card match-card-needs match-card-clickable"
                onClick={() => onSelectMatch(m.id)}
              >
                <span className="match-card-date">
                  Mon · {formatMatchDate(parseMatchDate(m.matchDate))}
                </span>
                <span className="match-card-title">
                  {shortName(m.home.name)} vs {shortName(m.away.name)}
                </span>
                <span className="match-card-status status-needs">● Pending</span>
              </button>
            ))}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <span className="option-label schedule-section-label">Upcoming</span>
            {upcoming.slice(0, 5).map((m) => (
              <button
                key={m.id}
                className="match-card match-card-upcoming match-card-clickable"
                onClick={() => onSelectMatch(m.id)}
              >
                <span className="match-card-date">
                  Mon · {formatMatchDate(parseMatchDate(m.matchDate))}
                </span>
                <span className="match-card-title">
                  {shortName(m.home.name)} vs {shortName(m.away.name)}
                </span>
                <span className="match-card-status status-upcoming">Scheduled</span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="panel schedule-calendar">
        <div className="calendar-header">
          <h3 className="panel-title">{monthLabel}</h3>
          <div className="calendar-nav">
            <button className="outline-btn calendar-nav-btn" onClick={() => goToMonth(-1)}>
              &lt;
            </button>
            <button className="outline-btn calendar-nav-btn" onClick={() => goToMonth(1)}>
              &gt;
            </button>
          </div>
        </div>

        <div className="calendar-grid">
          {DAY_LABELS.map((d) => (
            <div className="calendar-day-label" key={d}>
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            const dayMatches = day ? matchesByDay[`${year}-${month}-${day}`] || [] : [];
            return (
              <div
                className={`calendar-cell ${day ? '' : 'calendar-cell-empty'} ${isToday(day) ? 'calendar-cell-today' : ''}`}
                key={day ? `${year}-${month}-${day}` : `empty-${i}`}
              >
                {day && <span className="calendar-day-number">{day}</span>}
                {dayMatches.map((m) => (
                  <button
                    key={m.id}
                    className={`calendar-chip calendar-chip-${statusOf(m)} calendar-chip-clickable`}
                    onClick={() => onSelectMatch(m.id)}
                  >
                    {shortName(m.home.name)} vs {shortName(m.away.name)}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CalendarView;
