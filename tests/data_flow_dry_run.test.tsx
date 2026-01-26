import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventDetailModal } from "../src/features/events/components/EventDetailModal";
import { toPostgisPoint } from "../src/shared/lib/postgis";

import { selectMunicipalitiesForDiscovery } from "../supabase/functions/_shared/dutchMunicipalities.ts";
import type { EventWithAttendees } from "../src/features/events/hooks/hooks";

vi.mock("../src/features/location", () => ({
  useLocation: () => ({ location: null }),
}));

vi.mock("../src/shared/lib/haptics", () => ({
  hapticImpact: vi.fn().mockResolvedValue(undefined),
  hapticNotification: vi.fn().mockResolvedValue(undefined),
}));

const baseEvent = {
  category: "music",
  created_at: new Date().toISOString(),
  created_by: null,
  description: "City-wide celebration",
  event_type: "anchor",
  image_url: null,
  match_percentage: 90,
  max_attendees: null,
  parent_event_id: null,
  source_id: "serper-meppel",
  status: "active",
  updated_at: null,
};

const buildUtcDateTime = (date: string, time: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes || 0, 0),
  ).toISOString();
};

describe("Data Flow Dry Run: Serper → DB → EventCard", () => {
  const [meppel] = selectMunicipalitiesForDiscovery({
    municipalities: ["Meppel"],
    minPopulation: 1000,
    maxMunicipalities: 1,
  });

  const meppelCoords = {
    lat: meppel?.lat ?? 52.6957,
    lng: meppel?.lng ?? 6.1944,
  };

  it("maps Serper coordinates into PostGIS POINT and renders map marker in correct order", () => {
    const { point } = toPostgisPoint(meppelCoords);
    expect(point).toBe(`POINT(${meppelCoords.lng} ${meppelCoords.lat})`);

    const event = {
      ...baseEvent,
      id: "meppel-anchor",
      title: "Meppel Music Night",
      venue_name: "Theater Meppel",
      event_date: buildUtcDateTime("2026-07-12", "20:00"),
      event_time: "20:00",
      location: point,
      attendees: [],
      attendee_count: 0,
    };

    render(
      <EventDetailModal
        event={event as unknown as EventWithAttendees}
        onClose={() => {}}
      />,
    );

    const mapFrame = screen.getByTitle("Event location map");
    expect(mapFrame.getAttribute("src")).toContain(
      `${meppelCoords.lat},${meppelCoords.lng}`,
    );
    expect(screen.getByText(/Theater Meppel/i)).toBeInTheDocument();
  });

  it("shows Location Unknown badge when coordinates are missing or zeroed", () => {
    const zeroPoint = "POINT(0 0)";
    const event = {
      ...baseEvent,
      id: "meppel-unknown",
      title: "Locationless Meetup",
      venue_name: "Hidden Spot",
      event_date: buildUtcDateTime("2026-07-13", "18:00"),
      event_time: "18:00",
      location: zeroPoint,
      attendees: [],
      attendee_count: 0,
    };

    render(
      <EventDetailModal
        event={event as unknown as EventWithAttendees}
        onClose={() => {}}
      />,
    );

    expect(
      screen.getAllByText(/Location Unknown/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTitle("Event location map")).not.toBeInTheDocument();
  });
});
