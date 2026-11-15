// @vitest-environment jsdom
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { MapsService, PlaceResult } from "../lib/google-maps";
import { emptyRoute, hasCoordinates, type TripPoint } from "../lib/itinerary";
import { ItineraryEditor } from "../components/itinerary-editor";

// The real map needs Google; this stand-in reports a sample route once both ends are pinned.
vi.mock("../components/route-map", () => ({
  RouteMap: (props: {
    points: TripPoint[];
    onRouteInfo?: (r: unknown, loading: boolean) => void;
  }) => {
    const both = props.points.every(hasCoordinates);
    useEffect(() => {
      props.onRouteInfo?.(
        both ? { path: [], distanceMeters: 12345, durationMillis: 20 * 60000 } : null,
        false,
      );
    }, [both]);
    return <div data-testid="map" />;
  },
}));

const places: Record<string, PlaceResult> = {
  school: { name: "Punchbowl Public School", address: "1 School Rd, Punchbowl NSW 2196, Australia", lat: -33.92, lng: 151.05 },
  museum: { name: "Australian Museum", address: "1 William St, Sydney NSW 2010, Australia", lat: -33.87, lng: 151.21 },
};
const service: MapsService = {
  mapId: "test",
  google: {} as typeof google,
  suggest: vi.fn(async (input: string) =>
    Object.entries(places)
      .filter(([, p]) => p.name.toLowerCase().includes(input.toLowerCase()))
      .map(([id, p]) => ({ id, primary: p.name, secondary: "NSW", select: async () => p })),
  ),
  reverse: vi.fn(),
  route: vi.fn(),
};

function Harness({ onChange }: { onChange: (r: TripPoint[]) => void }) {
  const [route, setRoute] = useState(() => {
    const r = emptyRoute();
    r[0].notes = "Gate 3";
    return r;
  });
  return (
    <ItineraryEditor
      leg="outward"
      route={route}
      service={service}
      onChange={(r) => {
        setRoute(r);
        onChange(r);
      }}
    />
  );
}

async function pick(dialog: HTMLElement, field: string, text: string, option: RegExp) {
  fireEvent.change(within(dialog).getByRole("combobox", { name: field }), { target: { value: text } });
  fireEvent.mouseDown(await within(dialog).findByRole("option", { name: option }));
}

afterEach(cleanup);
describe("Map popup for pickup and drop-off", () => {
  it("opens from the map icon, picks both ends separately and shows a sample route", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const icon = screen.getByRole("button", { name: /Open map to choose the outward pickup point and drop-off/ });
    fireEvent.click(icon);
    const dialog = screen.getByRole("dialog", { name: "Your journey on the map" });
    expect(dialog.textContent).toContain("sample route for reference only");
    expect(dialog.textContent).toContain("doesn’t represent the exact bus route");
    const use = within(dialog).getByRole("button", { name: "Use these locations" }) as HTMLButtonElement;
    expect(use.disabled).toBe(true);

    await pick(dialog, "Pickup point", "Punchbowl", /Punchbowl Public School/);
    await pick(dialog, "Drop-off", "Museum", /Australian Museum/);
    const pickupCard = within(dialog).getByRole("region", { name: "Pickup point" });
    const dropCard = within(dialog).getByRole("region", { name: "Drop-off" });
    await waitFor(() => expect(within(pickupCard).getByText("1 School Rd, Punchbowl NSW 2196, Australia", { selector: "span" })).toBeTruthy());
    expect(within(pickupCard).getByText("Punchbowl Public School", { selector: "strong" })).toBeTruthy();
    expect(within(dropCard).getByText("Australian Museum", { selector: "strong" })).toBeTruthy();
    await within(dialog).findByText("Sample route · 12.3 km · about 20 min by car");

    expect(use.disabled).toBe(false);
    fireEvent.click(use);
    expect(screen.queryByRole("dialog")).toBeNull();
    const route = onChange.mock.calls.at(-1)![0] as TripPoint[];
    expect(route[0]).toMatchObject({ name: "Punchbowl Public School", lat: -33.92, notes: "Gate 3" });
    expect(route[1]).toMatchObject({ name: "Australian Museum", address: places.museum.address });
    expect(document.activeElement).toBe(icon);
  });
  it("closes on Escape and Cancel without changing the route", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Open map/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Open map/ }));
    await pick(screen.getByRole("dialog"), "Pickup point", "Punchbowl", /Punchbowl Public School/);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("hides the map icon when Google Maps isn't available", () => {
    render(<ItineraryEditor leg="outward" route={emptyRoute()} service={null} onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Open map/ })).toBeNull();
  });
});
