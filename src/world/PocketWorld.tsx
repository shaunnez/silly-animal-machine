import { gameRequest as read } from "../game-request";
import { assetUrl, browserStorage } from "../asset-url";
import { attractions, planetAttractions } from "./attractions";
import { SpaceTrip, type Flight } from "./SpaceTrip";
import { planets, planetIds, type PlanetId } from "./planets";
import type { WorldSound } from "./world-audio";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  BowlFood,
  BeachBall,
  Sparkle,
  ArrowCounterClockwise,
  ArrowClockwise,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  House,
  Moon,
  Plus,
  X,
} from "@phosphor-icons/react";
import { powerFor } from "../powers";
import type { Creature } from "../game";
import { createMeadow, type Meadow } from "./meadow";
import { activityText, type Command, type Friend } from "./meadow-simulation";
import {
  newCare,
  validateWorld,
  maxFriends,
  residentPlanet,
  moveResident,
  type WorldSave,
} from "./care";
import { worldSession } from "./world-session";
import { parseProgress, progressKey } from "./progress";
import { resolveModel } from "./models";
import "./world.css";

export default function PocketWorld({
  creature,
  focusCreature = false,
  creatures,
  onBack,
  onSound,
  onAudioPause,
}: {
  creature: Creature;
  focusCreature?: boolean;
  creatures: Creature[];
  onBack: () => void;
  onSound: (event: WorldSound) => void;
  onAudioPause: (paused: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const meadow = useRef<Meadow | null>(null);
  const saved = useRef<WorldSave | null>(null);
  const session = useRef<ReturnType<typeof worldSession> | null>(null);
  const chime = useRef(onSound);
  chime.current = onSound;
  const [selected, setSelected] = useState(creature.id);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [invited, setInvited] = useState<string[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [models, setModels] = useState<Record<string, string>>({});
  const [eligible, setEligible] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [sceneError, setSceneError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveTime, setSaveTime] = useState("");
  const [notice, setNotice] = useState("");
  const [picker, setPicker] = useState(false);
  const [replacement, setReplacement] = useState("");
  const [paused, setPaused] = useState(false);
  const [follow, setFollow] = useState(false);
  const [moving, setMoving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [planet, setPlanet] = useState<PlanetId>("meadow");
  const [travelOpen, setTravelOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const transitionLock = useRef(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const travelDialog = useRef<HTMLDialogElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const friend = friends.find((f) => f.id === selected);
  const current = creatures.find((c) => c.id === selected) ?? creature;
  const power = powerFor(current);
  const care = friend?.care ?? saved.current?.friends[selected];
  const [weather, setWeather] = useState<"sunny" | "rain" | "snow">("sunny");
  const conflict = saveError.includes("Another tab");
  const active =
    ready &&
    !!friend?.loaded &&
    !paused &&
    !saveError &&
    !sceneError &&
    !transitioning;
  const busy = moving || !!friend?.command || friend?.mode === "greet";
  useEffect(() => {
    let disposed = false;
    let local: Meadow | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    let localSession: ReturnType<typeof worldSession> | undefined;
    setReady(false);
    setSceneError("");
    setSaveError("");
    setModels({});
    setFriends([]);
    const persist = () => {
      void localSession?.flush();
    };
    async function open() {
      try {
        const [raw, manifest] = await Promise.all([
          read<unknown>("/api/world"),
          read<unknown>("/assets/models/creatures.json"),
        ]);
        if (disposed || !host.current) return;
        const state = validateWorld(raw);
        const modelIds = creatures
          .filter((c) => resolveModel(manifest, c))
          .map((c) => c.id);
        setEligible(modelIds);
        const ensure = (c: Creature) => {
          if (state.friends[c.id]) return;
          state.friends[c.id] = newCare();
          try {
            state.friends[c.id].progress = parseProgress(
              localStorage.getItem(progressKey(c.id)),
            );
          } catch {
            /* Local helper still saves care when legacy browser storage is unavailable. */
          }
        };
        if (Object.keys(state.friends).length === 0) {
          state.planets[state.activePlanet] = [
            creature,
            ...creatures.filter(
              (c) => c.id !== creature.id && modelIds.includes(c.id),
            ),
          ]
            .slice(0, maxFriends)
            .map((c) => c.id);
        }
        // A returning visit never pulls a resident away from another planet.
        for (const p of planetIds)
          state.planets[p] = state.planets[p].filter((id) =>
            creatures.some((c) => c.id === id),
          );
        if (focusCreature) {
          const home = residentPlanet(state, creature.id);
          if (home) state.activePlanet = home;
          else if (state.planets[state.activePlanet].length < maxFriends) {
            ensure(creature);
            moveResident(state, creature.id, state.activePlanet);
          } else {
            setNotice(
              `${creature.name} would love to join. Pick a planet with room or swap a friend.`,
            );
            setPicker(true);
          }
        }
        setPlanet(state.activePlanet);
        for (const id of state.planets[state.activePlanet])
          ensure(creatures.find((c) => c.id === id)!);
        saved.current = state;
        setInvited([...state.planets[state.activePlanet]]);
        const chosen = state.planets[state.activePlanet].includes(creature.id)
          ? creature.id
          : (state.planets[state.activePlanet][0] ?? creature.id);
        selectedRef.current = chosen;
        setSelected(chosen);

        local = createMeadow(host.current, {
          placement: setMoving,
          moved: (id, placed) =>
            setNotice(
              `${creatures.find((c) => c.id === id)?.name ?? "Your friend"} ${placed ? "landed safely!" : "is back where you picked them up."}`,
            ),
          view: setFollow,
          sound(event) {
            chime.current(event);
          },
          select(id) {
            if (!disposed) {
              chime.current(
                `animal:${creatures.find((c) => c.id === id)!.first}`,
              );
              setSelected(id);
              selectedRef.current = id;
              local?.select(id);
              setNotice("");
            }
          },
          complete(id, action) {
            if (disposed) return;
            persist();
            if (id === selectedRef.current) {
              const c = creatures.find((c) => c.id === id)!;
              setNotice(
                action === "nap"
                  ? `${c.name} feels refreshed!`
                  : `${c.name} loved that!`,
              );
            }
          },
          update(next) {
            if (!disposed)
              setFriends(
                next.map((f) => ({
                  ...f,
                  care: {
                    needs: { ...f.care.needs },
                    progress: { ...f.care.progress },
                  },
                })),
              );
          },
          loaded(id, status) {
            if (!disposed) setModels((m) => ({ ...m, [id]: status }));
          },
          error() {
            if (!disposed)
              setSceneError(
                "The 3D meadow couldn't open. Your creatures and saved care are safe.",
              );
          },
        });
        meadow.current = local;
        localSession = worldSession(
          state,
          async (snapshot) => {
            const { token } = await read<{ token: string }>("/api/status");
            return read<WorldSave>("/api/world", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "X-Game-Token": token,
              },
              body: JSON.stringify(snapshot),
              keepalive: true,
            });
          },
          (error) => {
            if (disposed) return;
            setSaveError(error?.message ?? "");
            if (error) local?.pause(true);
            else
              setSaveTime(
                browserStorage
                  ? "Saved on this device"
                  : "Saved on this computer",
              );
          },
        );
        session.current = localSession;
        local.planet(state.activePlanet);
        setWeather(state.activePlanet === "snow" ? "snow" : "sunny");
        for (const id of state.planets[state.activePlanet])
          local.add(
            creatures.find((c) => c.id === id)!,
            state.friends[id],
          );
        local.select(chosen);
        setReady(true);
        persist();
        interval = setInterval(persist, 5000);
        document.addEventListener("visibilitychange", persist);
        window.addEventListener("pagehide", persist);
      } catch (error) {
        if (!disposed)
          setSceneError(
            error instanceof Error
              ? error.message
              : "The meadow couldn't open.",
          );
      }
    }
    void open();
    return () => {
      disposed = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", persist);
      window.removeEventListener("pagehide", persist);
      persist();
      local?.dispose();
      if (meadow.current === local) meadow.current = null;
    };
    // A visit owns one simulation and save session; selecting a friend never restarts it.
  }, [retry]);
  useEffect(() => {
    meadow.current?.select(selected);
  }, [selected]);
  useEffect(() => {
    meadow.current?.pause(
      paused ||
        !!saveError ||
        !!sceneError ||
        picker ||
        travelOpen ||
        transitioning,
    );
    onAudioPause(
      paused ||
        !!saveError ||
        !!sceneError ||
        picker ||
        travelOpen ||
        (transitioning && !flight),
    );
  }, [
    paused,
    saveError,
    sceneError,
    picker,
    travelOpen,
    transitioning,
    ready,
    flight,
  ]);
  useEffect(() => {
    if (flight) chime.current("flight");
  }, [flight]);
  useEffect(() => {
    if (picker) dialog.current?.showModal();
  }, [picker]);
  useEffect(() => {
    if (travelOpen) travelDialog.current?.showModal();
  }, [travelOpen]);
  useEffect(() => () => onAudioPause(true), []);
  function showPlanet(state: WorldSave, preferred?: string) {
    const ids = state.planets[state.activePlanet];
    meadow.current?.planet(state.activePlanet);
    setPlanet(state.activePlanet);
    setWeather(state.activePlanet === "snow" ? "snow" : "sunny");
    setModels({});
    setFriends([]);
    setFollow(false);
    setNotice("");
    setInvited([...ids]);
    const chosen =
      preferred && ids.includes(preferred) ? preferred : (ids[0] ?? "");
    setSelected(chosen);
    selectedRef.current = chosen;
    for (const id of ids)
      meadow.current?.add(
        creatures.find((c) => c.id === id)!,
        state.friends[id],
      );
    meadow.current?.select(chosen);
  }
  async function visit(destination: PlanetId, passenger?: Creature) {
    const state = saved.current;
    if (
      !state ||
      !session.current ||
      transitionLock.current ||
      saveError ||
      sceneError ||
      destination === state.activePlanet
    )
      return;
    if (passenger && state.planets[destination].length >= maxFriends) {
      setNotice("That planet is full. Make room for your friend first.");
      return;
    }
    transitionLock.current = true;
    setTransitioning(true);
    setTravelOpen(false);
    setPicker(false);
    meadow.current?.pause(true);
    onAudioPause(true);
    const from = state.activePlanet;
    if (!(await session.current.flush())) {
      transitionLock.current = false;
      setTransitioning(false);
      return;
    }
    const previous = structuredClone(state.planets);
    if (passenger) moveResident(state, passenger.id, destination);
    state.activePlanet = destination;
    if (!(await session.current.flush())) {
      state.planets = previous;
      state.activePlanet = from;
      transitionLock.current = false;
      setTransitioning(false);
      return;
    }
    showPlanet(state, passenger?.id);
    if (passenger) {
      setFlight({ friend: passenger, from, to: destination });
    } else {
      transitionLock.current = false;
      setTransitioning(false);
    }
  }
  function act(action: Command) {
    if (!active || busy) return;
    const error = meadow.current?.command(selected, action);
    if (error) {
      setNotice(error);
      return;
    }
    setNotice(
      action === "nap"
        ? "Off to the cosy nap nook…"
        : action === "feed"
          ? "Let's find an apple at the picnic!"
          : action === "play"
            ? "Off to the ball patch!"
            : power.message,
    );
    chime.current("join");
  }
  function invite(c: Creature) {
    const state = saved.current;
    if (!state || saveError || transitionLock.current) return;
    const home = residentPlanet(state, c.id);
    if (home && home !== state.activePlanet) {
      void visit(home);
      return;
    }
    if (state.planets[state.activePlanet].includes(c.id)) {
      setSelected(c.id);
      setPicker(false);
      return;
    }
    if (
      state.planets[state.activePlanet].length >= maxFriends &&
      !replacement
    ) {
      setNotice("Choose a friend to rest at home, then invite someone new.");
      return;
    }
    if (state.planets[state.activePlanet].length >= maxFriends) {
      meadow.current?.remove(replacement);
      state.planets[state.activePlanet] = state.planets[
        state.activePlanet
      ].filter((id) => id !== replacement);
    }
    if (!state.friends[c.id]) {
      state.friends[c.id] = newCare();
      try {
        state.friends[c.id].progress = parseProgress(
          localStorage.getItem(progressKey(c.id)),
        );
      } catch {
        /* Care is saved by the local helper. */
      }
    }
    state.planets[state.activePlanet].push(c.id);
    meadow.current?.add(c, state.friends[c.id]);
    setInvited([...state.planets[state.activePlanet]]);
    setSelected(c.id);
    setReplacement("");
    setPicker(false);
    setNotice(`${c.name} is joining ${planets[state.activePlanet].name}!`);
    void session.current?.flush();
  }
  function rest(id: string) {
    const state = saved.current;
    if (!state || saveError || transitionLock.current) return;
    meadow.current?.remove(id);
    state.planets[state.activePlanet] = state.planets[
      state.activePlanet
    ].filter((c) => c !== id);
    setInvited([...state.planets[state.activePlanet]]);
    setFriends((f) => f.filter((c) => c.id !== id));
    setSelected(state.planets[state.activePlanet][0] ?? creature.id);
    setReplacement("");
    void session.current?.flush();
  }
  return (
    <main
      className="pocket-world panel shared-world galaxy-world"
      aria-label="Pocket Creature World"
    >
      <div className="world-heading">
        <button
          className="world-back"
          onClick={onBack}
          disabled={transitioning}
        >
          <ArrowLeft size={20} /> My creatures
        </button>
        <div>
          <p className="eyebrow">LITTLE FRIENDS, BIG ADVENTURES</p>
          <h2>Pocket Creature Worlds</h2>
        </div>
        <button
          className="world-back invite-button"
          disabled={!ready || !!saveError || transitioning}
          onClick={() => {
            setReplacement("");
            setPicker(true);
          }}
        >
          <Plus size={20} /> Invite friends <span>{invited.length}/6</span>
        </button>
      </div>
      <div className="world-layout">
        <div className="world-scene-wrap">
          <div
            ref={host}
            className="world-canvas"
            role="group"
            aria-label="Shared meadow. Tap a creature to select it, or use its name or the friend list."
          />
          <div
            className="planet-switcher"
            role="group"
            aria-label="Choose a planet"
          >
            {planetIds.map((id) => (
              <button
                key={id}
                aria-pressed={planet === id}
                disabled={!ready || transitioning || !!saveError}
                onClick={() => void visit(id)}
                aria-label={`Visit ${planets[id].name} planet`}
              >
                <span>{planets[id].icon}</span>
                <span>
                  {planets[id].name}
                  <small>
                    {saved.current?.planets[id].length ?? 0}/6 friends
                  </small>
                </span>
              </button>
            ))}
          </div>
          <div className="world-scene-label">
            <span className="world-dot" />
            {paused
              ? "World paused"
              : `${planets[planet].name} · ${invited.length} little ${invited.length === 1 ? "friend" : "friends"}`}
          </div>
          {!ready && !sceneError && (
            <div className="world-loading" role="status">
              <Sparkle size={36} />
              <p>Opening your little world…</p>
            </div>
          )}
          {sceneError && (
            <div className="world-loading" role="alert">
              <h3>The meadow needs a moment.</h3>
              <p>{sceneError}</p>
              <button onClick={() => setRetry((r) => r + 1)}>
                Try the meadow again
              </button>
              <button onClick={onBack}>Back to my creatures</button>
            </div>
          )}
          {transitioning && !flight && (
            <div className="world-loading" role="status">
              <p>Getting your planet ready…</p>
            </div>
          )}
          {flight && (
            <SpaceTrip
              flight={flight}
              onArrive={() => {
                setNotice(
                  `${flight.friend.name} landed on ${planets[flight.to].name}!`,
                );
                setFlight(null);
                transitionLock.current = false;
                setTransitioning(false);
              }}
            />
          )}
          <div
            className="world-weather"
            role="group"
            aria-label="World weather"
          >
            {(["sunny", "rain", "snow"] as const).map((value) => (
              <button
                key={value}
                aria-label={`${value} weather`}
                aria-pressed={weather === value}
                onClick={() => {
                  setWeather(value);
                  meadow.current?.weather(value);
                }}
              >
                {value === "sunny" ? "☀️" : value === "rain" ? "🌦️" : "❄️"}
              </button>
            ))}
          </div>
          <div
            className="planet-playground"
            role="group"
            aria-label={`${planets[planet].name} playground`}
          >
            <span>Only on {planets[planet].name}</span>
            {planetAttractions(planet).map((kind) => (
              <button
                key={kind}
                disabled={!active || busy}
                onClick={() => {
                  const error = meadow.current?.attraction(selected, kind);
                  setNotice(
                    error ??
                      `Off to ${attractions[kind].place}! Friends can join too.`,
                  );
                }}
              >
                {attractions[kind].icon} {attractions[kind].name}
              </button>
            ))}
          </div>
          <div className="world-views" role="group" aria-label="Camera views">
            {(
              [
                ["whole", "Whole planet"],
                ["playground", "Playground"],
                ["friend", "Friend view"],
              ] as const
            ).map(([view, label]) => (
              <button
                key={view}
                disabled={!ready || moving || !!sceneError}
                onClick={() => meadow.current?.preset(view)}
              >
                {label}
              </button>
            ))}
            <button
              disabled={!active}
              aria-pressed={moving}
              onClick={() =>
                moving
                  ? meadow.current?.cancelMove()
                  : meadow.current?.moveFriend()
              }
            >
              {moving ? "Cancel move" : "Move friend"}
            </button>
          </div>
          {moving && (
            <div className="world-placement" role="status">
              Move to a green ring. Tap ground or use arrow keys; Enter to place
              · Esc to cancel
              <button onClick={() => meadow.current?.placeFriend()}>
                Place here
              </button>
              <button onClick={() => meadow.current?.cancelMove()}>
                Cancel
              </button>
            </div>
          )}
          <div className="world-camera" aria-label="Camera controls">
            {(
              [
                ["left", "Turn camera left", ArrowCounterClockwise],
                ["right", "Turn camera right", ArrowClockwise],
                ["up", "Turn world up", ArrowUp],
                ["down", "Turn world down", ArrowDown],
                ["in", "Zoom in", MagnifyingGlassPlus],
                ["out", "Zoom out", MagnifyingGlassMinus],
                ["reset", "See whole meadow", House],
              ] as const
            ).map(([action, label, Icon]) => (
              <button
                key={action}
                aria-label={label}
                disabled={!ready || !!sceneError || moving}
                onClick={() => {
                  meadow.current?.camera(action);
                  if (action === "reset") setFollow(false);
                }}
              >
                <Icon size={22} />
              </button>
            ))}
          </div>
          <p className="world-drag-hint">
            Drag a friend to lift · drag the ground to spin
          </p>
        </div>
        <aside className="world-play-panel" aria-label="Creature care">
          <div
            className="meadow-friends"
            role="group"
            aria-label="Friends in the meadow"
          >
            {invited.map((id, i) => {
              const c = creatures.find((c) => c.id === id)!;
              return (
                <button
                  key={id}
                  aria-label={`Choose ${c.name}, friend ${i + 1}`}
                  aria-pressed={selected === id}
                  onClick={() => {
                    chime.current(`animal:${c.first}`);
                    setSelected(id);
                    setNotice("");
                  }}
                >
                  <img src={assetUrl(c.image)} alt="" />
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
          {ready && invited.length === 0 && !transitioning && (
            <div className="empty-care">
              <span className="empty-planet-icon" aria-hidden="true">
                {planets[planet].icon}
              </span>
              <h3>Welcome to {planets[planet].name}!</h3>
              <p>{planets[planet].description}</p>
              <button onClick={() => setPicker(true)}>
                Invite your first friend
              </button>
            </div>
          )}
          {invited.length > 0 && (
            <>
              <div className="world-greeting">
                <img src={assetUrl(current.image)} alt="" />
                <div>
                  <span>
                    {models[selected] === "model"
                      ? "Selected friend"
                      : models[selected]
                        ? "Selected picture guest"
                        : "Arriving…"}{" "}
                    · {power.icon} {power.name}
                  </span>
                  <h3>{current.name}</h3>
                </div>
              </div>
              <div
                className="care-needs"
                aria-label={`${current.name}'s needs`}
              >
                {(
                  [
                    ["food", "Tummy", "🍎"],
                    ["energy", "Energy", "🌙"],
                    ["joy", "Happiness", "💛"],
                  ] as const
                ).map(([id, label, icon]) => (
                  <label key={id}>
                    <span>
                      {icon} {label}
                      <b>{Math.round(care?.needs[id] ?? 80)}%</b>
                    </span>
                    <meter
                      min={10}
                      max={100}
                      low={40}
                      optimum={100}
                      value={care?.needs[id] ?? 80}
                      aria-label={`${label} for ${current.name}`}
                    />
                  </label>
                ))}
              </div>
              <p className="world-message" role="status">
                {(friend?.outing
                  ? friend.mode === "attraction"
                    ? attractions[friend.outing.kind].doing
                    : `Going to ${attractions[friend.outing.kind].place}`
                  : "") ||
                  (friend?.company?.length
                    ? `${friend.mode === "play" ? "Playing ball" : "Dancing"} with ${friend.company.map((id) => creatures.find((c) => c.id === id)?.name).join(", ")}`
                    : "") ||
                  (friend &&
                  ["nap", "play", "magic", "feed"].includes(friend.mode)
                    ? activityText[friend.mode]
                    : "") ||
                  notice ||
                  (friend
                    ? activityText[friend.mode]
                    : `${current.name} is on the way!`)}
              </p>
              <div className="world-actions care-actions">
                <span className="mobile-care-name">
                  {current.name} ·{" "}
                  {paused
                    ? "Paused"
                    : busy
                      ? "Having a little moment…"
                      : "What shall we do?"}
                </span>
                <button
                  className="world-feed"
                  disabled={!active || busy}
                  onClick={() => act("feed")}
                >
                  <BowlFood weight="fill" size={26} />
                  <span>
                    Give a snack<small>Apple picnic time</small>
                  </span>
                </button>
                <button
                  className="world-play"
                  disabled={!active || busy}
                  onClick={() => act("play")}
                >
                  <BeachBall weight="fill" size={26} />
                  <span>
                    Play ball<small>Kick, chase, celebrate</small>
                  </span>
                </button>
                <button
                  className="world-magic"
                  disabled={!active || busy}
                  onClick={() => act("magic")}
                >
                  <Sparkle weight="fill" size={26} />
                  <span>
                    {power.action}
                    <small>{power.hint}</small>
                  </span>
                </button>
                <button
                  className="world-nap"
                  disabled={!active || busy}
                  onClick={() => act("nap")}
                >
                  <Moon weight="fill" size={26} />
                  <span>
                    Have a nap<small>Rest in the cosy nook</small>
                  </span>
                </button>
              </div>
              <button
                className="space-travel-button"
                disabled={!ready || !!saveError || transitioning}
                onClick={() => setTravelOpen(true)}
              >
                🚀 Fly {current.name} to another planet
              </button>
              <div className="meadow-toggles">
                <button
                  aria-pressed={follow}
                  disabled={!ready}
                  onClick={() => {
                    setFollow(!follow);
                    meadow.current?.follow(!follow);
                  }}
                >
                  {follow ? "Following friend" : "Follow friend"}
                </button>
                <button
                  aria-pressed={paused}
                  disabled={!ready}
                  onClick={() => setPaused(!paused)}
                >
                  {paused ? "Resume world" : "Pause world"}
                </button>
              </div>
            </>
          )}
          <p className="world-kind-note">Care stays safe while you’re away.</p>
          {saveError ? (
            <div className="world-storage-warning" role="alert">
              <p>{saveError} Play is paused to protect your save.</p>
              <button
                onClick={() =>
                  conflict
                    ? setRetry((r) => r + 1)
                    : void session.current?.flush(true)
                }
              >
                {conflict ? "Load latest meadow" : "Try saving again"}
              </button>
            </div>
          ) : (
            <p className="world-save-status" role="status">
              {saveTime}
            </p>
          )}
        </aside>
      </div>
      {travelOpen && (
        <dialog
          ref={travelDialog}
          className="travel-dialog"
          onCancel={() => setTravelOpen(false)}
        >
          <button
            className="icon-button close"
            aria-label="Close spaceship trips"
            onClick={() => setTravelOpen(false)}
          >
            <X size={22} />
          </button>
          <p className="eyebrow">READY FOR LIFT-OFF?</p>
          <h2>Where shall {current.name} fly?</h2>
          <p>Their care and friendship travel with them.</p>
          <div className="travel-destinations">
            {planetIds
              .filter((id) => id !== planet)
              .map((id) => (
                <button
                  key={id}
                  disabled={
                    (saved.current?.planets[id].length ?? 0) >= maxFriends
                  }
                  onClick={() => void visit(id, current)}
                >
                  <span>{planets[id].icon}</span>
                  <strong>{planets[id].name}</strong>
                  <small>
                    {saved.current?.planets[id].length ?? 0}/6 friends
                    {(saved.current?.planets[id].length ?? 0) >= maxFriends
                      ? " · Full"
                      : " · Fly here"}
                  </small>
                </button>
              ))}
          </div>
        </dialog>
      )}
      {picker && (
        <dialog
          ref={dialog}
          className="invite-dialog"
          onCancel={() => setPicker(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPicker(false);
          }}
        >
          <button
            className="icon-button close"
            aria-label="Close invite friends"
            onClick={() => setPicker(false)}
          >
            <X size={22} />
          </button>
          <p className="eyebrow">THERE’S ROOM FOR SIX</p>
          <h2>Who's coming to play?</h2>
          <p>
            Six friends per planet, 24 across your galaxy. Friends elsewhere
            keep their care.
          </p>
          {invited.length >= maxFriends && (
            <label className="swap-picker">
              This planet is full. Swap out:
              <select
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              >
                <option value="">Choose a friend to rest</option>
                {invited.map((id, i) => (
                  <option key={id} value={id}>
                    {creatures.find((c) => c.id === id)?.name} · friend {i + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="invite-grid">
            {creatures.map((c, i) => {
              const here = invited.includes(c.id);
              const home = saved.current && residentPlanet(saved.current, c.id);
              return (
                <div key={c.id} className="invite-card">
                  <img loading="lazy" src={assetUrl(c.image)} alt="" />
                  <h3>{c.name}</h3>
                  <p>
                    {powerFor(c).icon} {powerFor(c).name}
                    {!eligible.includes(c.id) && " · Picture guest"}
                  </p>
                  {here ? (
                    <>
                      <button
                        onClick={() => invite(c)}
                        aria-label={`Choose visiting ${c.name}, creature ${i + 1}`}
                      >
                        On {planets[planet].name} ✓
                      </button>
                      <button
                        className="rest-friend"
                        aria-label={`Let ${c.name} rest at home, creature ${i + 1}`}
                        onClick={() => rest(c.id)}
                      >
                        Rest at home
                      </button>
                    </>
                  ) : (
                    <button
                      aria-label={
                        home
                          ? `Visit ${c.name} on ${planets[home].name}, creature ${i + 1}`
                          : `Invite ${c.name}, creature ${i + 1}`
                      }
                      disabled={
                        !home && invited.length >= maxFriends && !replacement
                      }
                      onClick={() => invite(c)}
                    >
                      {home
                        ? `Visit ${planets[home].name}`
                        : invited.length >= maxFriends
                          ? "Swap onto planet"
                          : `Invite to ${planets[planet].name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </dialog>
      )}
    </main>
  );
}
