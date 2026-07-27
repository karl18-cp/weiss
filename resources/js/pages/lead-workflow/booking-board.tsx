import { Head, Link } from "@inertiajs/react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Navigation,
  Search,
  UserRound,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/../css/booking-board.css";
import { appointmentDate, appointmentDateKey } from "@/lib/appointment-date";

type Salesman = {
  salesman_id: number;
  salesman_name: string;
};

type BookingLead = {
  id: number;
  customer_name: string;
  primary_number: string;
  mobile_number: string | null;
  email: string | null;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number | null;
  longitude: number | null;
  appointment_at: string;
  appointment_duration_minutes: number;
  status: "confirmed" | "dispatched";
  source: string;
  confirmation_notes: string | null;
  telemarketer_notes: string;
  company: { company: string; prefix: string } | null;
  product: { product_name: string } | null;
  agent: { agent_name: string } | null;
  second_agent: { agent_name: string } | null;
  salesman_one: Salesman | null;
  salesman_two: Salesman | null;
  notes: {
    id: number;
    note_type: string;
    body: string;
    created_at: string;
  }[];
};

type ViewMode = "daily" | "weekly" | "monthly";

type BookingBoardProps = {
  leads: BookingLead[];
  salesmen: Salesman[];
  map: { key: string | null; styleUrl: string };
  viewerRole: string;
  viewerSalesmanId: number | null;
  leadBaseUrl?: string;
};

const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_WIDTH = 90;
const SALESMAN_COLORS = [
  "#2563eb",
  "#0f9f8f",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#4d7c0f",
];

const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const fullAddress = (lead: BookingLead) =>
  `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip_code}`;

const appleMapsUrl = (lead: BookingLead) =>
  `https://maps.apple.com/?daddr=${encodeURIComponent(fullAddress(lead))}&dirflg=d`;

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const dateFromKey = (key: string) => new Date(`${key}T12:00:00`);

const changeDate = (key: string, days: number) => {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);

  return localDateKey(date);
};

const salesmanColor = (id: number | null, salesmen: Salesman[]) => {
  const index = id
    ? Math.max(
        0,
        salesmen.findIndex((salesman) => salesman.salesman_id === id),
      )
    : salesmen.length;

  return SALESMAN_COLORS[index % SALESMAN_COLORS.length];
};

function BookingMap({
  leads,
  selected,
  onSelect,
  mapConfig,
  salesmen,
}: {
  leads: BookingLead[];
  selected: BookingLead | null;
  onSelect: (id: number) => void;
  mapConfig: BookingBoardProps["map"];
  salesmen: Salesman[];
}) {
  const mappedLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          Number.isFinite(lead.latitude) && Number.isFinite(lead.longitude),
      ),
    [leads],
  );
  const camera = useMemo(() => {
    if (mappedLeads.length === 0) {
      return { longitude: -118.2437, latitude: 34.0522, zoom: 8 };
    }

    const longitudes = mappedLeads.map((lead) => Number(lead.longitude));
    const latitudes = mappedLeads.map((lead) => Number(lead.latitude));
    const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
    const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
    const span = Math.max(longitudeSpan, latitudeSpan);
    const zoom =
      mappedLeads.length === 1
        ? 12
        : span > 5
          ? 5
          : span > 2
            ? 6
            : span > 1
              ? 7
              : span > 0.5
                ? 8
                : span > 0.2
                  ? 9
                  : span > 0.08
                    ? 10
                    : 11;

    return {
      longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
      latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
      zoom,
    };
  }, [mappedLeads]);
  const cameraKey =
    mappedLeads.map((lead) => lead.id).join("-") || "no-mapped-leads";

  if (!mapConfig.key) {
    return (
      <div className="booking-map-message">
        <MapPin />
        <strong>Browser map key not configured</strong>
        <span>
          Add MAPTILER_BROWSER_KEY to the server environment and clear
          Laravel&apos;s configuration cache.
        </span>
      </div>
    );
  }

  return (
    <Map
      key={cameraKey}
      initialViewState={camera}
      mapStyle={`${mapConfig.styleUrl}?key=${mapConfig.key}`}
      cooperativeGestures
    >
      <NavigationControl position="top-right" showCompass={false} />
      {mappedLeads.map((lead) => {
        const salesmanId =
          lead.salesman_one?.salesman_id ??
          lead.salesman_two?.salesman_id ??
          null;

        return (
          <Marker
            key={lead.id}
            longitude={Number(lead.longitude)}
            latitude={Number(lead.latitude)}
            anchor="bottom"
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              onSelect(lead.id);
            }}
          >
            <button
              type="button"
              className={`booking-map-pin ${
                selected?.id === lead.id ? "is-selected" : ""
              }`}
              style={
                {
                  "--pin-color": salesmanColor(salesmanId, salesmen),
                } as CSSProperties
              }
              aria-label={`Open ${lead.customer_name}`}
            >
              <MapPin />
            </button>
          </Marker>
        );
      })}
      {selected?.latitude != null && selected.longitude != null && (
        <Popup
          longitude={Number(selected.longitude)}
          latitude={Number(selected.latitude)}
          anchor="bottom"
          offset={34}
          closeButton={false}
          closeOnClick={false}
        >
          <div className="booking-map-popup">
            <strong>{selected.customer_name}</strong>
            <span>
              {timeFormatter.format(appointmentDate(selected.appointment_at))}
            </span>
            <small>{fullAddress(selected)}</small>
          </div>
        </Popup>
      )}
    </Map>
  );
}

export default function BookingBoard({
  leads,
  salesmen,
  map,
  viewerRole,
  viewerSalesmanId,
  leadBaseUrl = "/lead-workflow/leads-shop",
}: BookingBoardProps) {
  const visibleLeads = useMemo(
    () =>
      viewerRole !== "salesman" || viewerSalesmanId === null
        ? leads
        : leads.filter((lead) =>
            [
              lead.salesman_one?.salesman_id,
              lead.salesman_two?.salesman_id,
            ].includes(viewerSalesmanId),
          ),
    [leads, viewerRole, viewerSalesmanId],
  );
  const today = localDateKey(new Date());
  const firstDate = visibleLeads[0]
    ? appointmentDateKey(visibleLeads[0].appointment_at)
    : today;
  const [selectedDate, setSelectedDate] = useState(
    visibleLeads.some(
      (lead) => appointmentDateKey(lead.appointment_at) === today,
    )
      ? today
      : firstDate,
  );
  const [view, setView] = useState<ViewMode>("daily");
  const [search, setSearch] = useState("");
  const [selectedSalesman, setSelectedSalesman] = useState<number | "all">(
    "all",
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedDateValue = dateFromKey(selectedDate);

  const periodLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selected = dateFromKey(selectedDate);
    const weekStart = new Date(selected);
    weekStart.setDate(selected.getDate() - selected.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return visibleLeads.filter((lead) => {
      const date = appointmentDate(lead.appointment_at);
      const inPeriod =
        view === "daily"
          ? appointmentDateKey(lead.appointment_at) === selectedDate
          : view === "weekly"
            ? date >= weekStart && date < weekEnd
            : date.getMonth() === selected.getMonth() &&
              date.getFullYear() === selected.getFullYear();
      const salesmanIds = [
        lead.salesman_one?.salesman_id,
        lead.salesman_two?.salesman_id,
      ];
      const matchesSalesman =
        selectedSalesman === "all" || salesmanIds.includes(selectedSalesman);
      const matchesSearch = [
        lead.customer_name,
        lead.address,
        lead.city,
        lead.product?.product_name,
        lead.company?.company,
        lead.salesman_one?.salesman_name,
        lead.salesman_two?.salesman_name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

      return inPeriod && matchesSalesman && matchesSearch;
    });
  }, [visibleLeads, search, selectedDate, selectedSalesman, view]);

  const dayLeads = useMemo(
    () =>
      periodLeads.filter(
        (lead) => appointmentDateKey(lead.appointment_at) === selectedDate,
      ),
    [periodLeads, selectedDate],
  );
  const selected = periodLeads.find((lead) => lead.id === selectedId) ?? null;
  const mappedCount = periodLeads.filter(
    (lead) => lead.latitude != null && lead.longitude != null,
  ).length;
  const timelineSalesmen = useMemo(() => {
    const rows = salesmen.filter(
      (salesman) =>
        selectedSalesman === "all" || salesman.salesman_id === selectedSalesman,
    );
    const hasUnassigned = dayLeads.some(
      (lead) => !lead.salesman_one && !lead.salesman_two,
    );

    return [
      ...rows.map((salesman) => ({
        id: salesman.salesman_id,
        name: salesman.salesman_name,
      })),
      ...(hasUnassigned ? [{ id: null, name: "Unassigned" }] : []),
    ];
  }, [dayLeads, salesmen, selectedSalesman]);

  const movePeriod = (direction: -1 | 1) => {
    const amount = view === "daily" ? 1 : view === "weekly" ? 7 : 30;
    setSelectedDate(changeDate(selectedDate, amount * direction));
    setSelectedId(null);
  };

  const periodTitle =
    view === "daily"
      ? longDateFormatter.format(selectedDateValue)
      : view === "weekly"
        ? `Week of ${shortDateFormatter.format(selectedDateValue)}`
        : new Intl.DateTimeFormat("en-US", {
            month: "long",
            year: "numeric",
          }).format(selectedDateValue);

  return (
    <>
      <Head title="Booking Board" />
      <main className="booking-board-page">
        <header className="booking-board-heading">
          <div>
            <span>Lead workflow</span>
            <h1>
              {viewerRole === "salesman"
                ? "My Booking Board"
                : "Booking Board"}
            </h1>
            <p>
              {viewerRole === "salesman"
                ? "Your assigned appointments and lead locations."
                : "Every salesman, appointment, and assigned lead location."}
            </p>
          </div>
          <div className="booking-board-summary">
            <span>
              <CalendarDays />
              <strong>{periodLeads.length}</strong> appointments
            </span>
            <span>
              <MapPin />
              <strong>{mappedCount}</strong> mapped
            </span>
          </div>
        </header>

        <section className="booking-board-map">
          <BookingMap
            leads={periodLeads}
            selected={selected}
            onSelect={setSelectedId}
            mapConfig={map}
            salesmen={salesmen}
          />
          {viewerRole !== "salesman" && (
            <div className="booking-map-legend">
              {salesmen.map((salesman) => (
              <button
                key={salesman.salesman_id}
                type="button"
                onClick={() =>
                  setSelectedSalesman((current) =>
                    current === salesman.salesman_id
                      ? "all"
                      : salesman.salesman_id,
                  )
                }
                className={
                  selectedSalesman === salesman.salesman_id ? "is-selected" : ""
                }
              >
                <i
                  style={{
                    background: salesmanColor(salesman.salesman_id, salesmen),
                  }}
                />
                {salesman.salesman_name}
              </button>
              ))}
            </div>
          )}
        </section>

        <section className="booking-board-controls">
          <label>
            <Search />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search bookings..."
            />
          </label>
          <div className="booking-date-control">
            <button type="button" onClick={() => movePeriod(-1)}>
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="booking-date-control__today"
              onClick={() => setSelectedDate(today)}
            >
              Today
            </button>
            <strong>{periodTitle}</strong>
            <button type="button" onClick={() => movePeriod(1)}>
              <ChevronRight />
            </button>
          </div>
          <div className="booking-view-control">
            {(["daily", "weekly", "monthly"] as const).map((option) => (
              <button
                type="button"
                key={option}
                className={view === option ? "is-selected" : ""}
                onClick={() => setView(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        <section className="booking-timeline">
          <div className="booking-timeline__scroll">
            <div
              className="booking-timeline__content"
              style={
                {
                  "--timeline-width": `${(END_HOUR - START_HOUR) * HOUR_WIDTH}px`,
                  "--hour-width": `${HOUR_WIDTH}px`,
                } as CSSProperties
              }
            >
              <div className="booking-timeline__header">
                <div className="booking-timeline__corner">
                  {viewerRole === "salesman" ? "My Schedule" : "Salesman"}
                </div>
                <div className="booking-timeline__hours">
                  {Array.from(
                    { length: END_HOUR - START_HOUR },
                    (_, index) => START_HOUR + index,
                  ).map((hour) => (
                    <span key={hour}>
                      {new Intl.DateTimeFormat("en-US", {
                        hour: "numeric",
                      }).format(new Date(2026, 0, 1, hour))}
                    </span>
                  ))}
                </div>
              </div>
              {timelineSalesmen.map((salesman) => {
                const appointments = dayLeads.filter((lead) =>
                  salesman.id === null
                    ? !lead.salesman_one && !lead.salesman_two
                    : [
                        lead.salesman_one?.salesman_id,
                        lead.salesman_two?.salesman_id,
                      ].includes(salesman.id),
                );
                const color = salesmanColor(salesman.id, salesmen);

                return (
                  <div
                    className="booking-timeline__row"
                    key={salesman.id ?? "unassigned"}
                  >
                    <div className="booking-salesman">
                      <i style={{ background: color }} />
                      <span>
                        <strong>{salesman.name}</strong>
                        <small>{appointments.length} appointments</small>
                      </span>
                    </div>
                    <div className="booking-time-track">
                      {appointments.map((lead) => {
                        const date = appointmentDate(lead.appointment_at);
                        const startMinutes =
                          date.getHours() * 60 +
                          date.getMinutes() -
                          START_HOUR * 60;
                        const left =
                          (Math.max(0, startMinutes) / 60) * HOUR_WIDTH;
                        const width =
                          (Math.max(
                            30,
                            lead.appointment_duration_minutes || 60,
                          ) /
                            60) *
                          HOUR_WIDTH;

                        return (
                          <button
                            type="button"
                            key={lead.id}
                            className={`booking-appointment is-${lead.status} ${
                              selected?.id === lead.id ? "is-selected" : ""
                            }`}
                            style={
                              {
                                left,
                                width,
                                "--appointment-color": color,
                              } as CSSProperties
                            }
                            onClick={() => setSelectedId(lead.id)}
                            title={`${timeFormatter.format(date)} — ${lead.customer_name}`}
                          >
                            <strong>{lead.customer_name}</strong>
                            <span>
                              {timeFormatter.format(date)} · {lead.city}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {timelineSalesmen.length === 0 && (
                <div className="booking-timeline-empty">
                  No salesmen match this view.
                </div>
              )}
            </div>
          </div>
        </section>

        {selected && (
          <aside className="booking-selection">
            <button
              type="button"
              className="booking-selection__close"
              onClick={() => setSelectedId(null)}
            >
              ×
            </button>
            <div>
              <span className={`booking-status is-${selected.status}`}>
                {selected.status}
              </span>
              <h2>{selected.customer_name}</h2>
              <p>
                <Clock3 />
                {timeFormatter.format(appointmentDate(selected.appointment_at))}
                <MapPin />
                {fullAddress(selected)}
              </p>
            </div>
            <div className="booking-selection__team">
              <UserRound />
              <span>
                <strong>
                  {selected.salesman_one?.salesman_name ?? "Unassigned"}
                </strong>
                {selected.salesman_two && (
                  <small>with {selected.salesman_two.salesman_name}</small>
                )}
              </span>
            </div>
            <div className="booking-selection__actions">
              <a
                className="booking-selection__apple-maps"
                href={appleMapsUrl(selected)}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation />
                Apple Maps
              </a>
              <Link href={`${leadBaseUrl}?lead=${selected.id}`}>
                Open lead
              </Link>
            </div>
          </aside>
        )}
      </main>
    </>
  );
}
