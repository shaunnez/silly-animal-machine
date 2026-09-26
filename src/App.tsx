import { gameRequest as request } from "./game-request";
import { assetUrl, browserStorage } from "./asset-url";
import { createWorldAudio } from "./world/world-audio";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Star,
  Sparkle,
  MagicWand,
  Heart,
  House,
  SpeakerHigh,
  SpeakerSlash,
  Shuffle,
  X,
  DownloadSimple,
  CheckCircle,
  Flower,
  GearSix,
  Play,
  CircleNotch,
} from "@phosphor-icons/react";
import { animals, sample, type Animal, type Creature, type Job } from "./game";

import { powers, powerFor, type PowerId } from "./powers";

const PocketWorld = lazy(() => import("./world/PocketWorld"));

type Status = {
  ready: boolean;
  message: string;
  token: string;
  activeJob?: string;
};
function AnimalArt({ animal }: { animal: Animal }) {
  const index = animals.findIndex((a) => a.id === animal);
  return (
    <span
      aria-hidden="true"
      className="animal-art"
      style={{
        backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`,
      }}
    />
  );
}
function AnimalPicker({
  step,
  value,
  other,
  onChange,
  disabled,
}: {
  step: number;
  value: Animal;
  other: Animal;
  onChange: (v: Animal) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className={`animal-picker picker-${step}`} disabled={disabled}>
      <legend>
        <span className="step-number">{step}</span> Choose Animal {step}
      </legend>
      <span className="picker-hint">
        {step === 1 ? "Pick one!" : "Pick another one!"}
      </span>
      <div className="animal-grid">
        {animals.map((animal) => (
          <button
            type="button"
            key={animal.id}
            aria-pressed={value === animal.id}
            aria-label={`${animal.name}, animal ${step}`}
            disabled={other === animal.id}
            onClick={() => onChange(animal.id)}
            className={`animal-card ${value === animal.id ? "selected" : ""}`}
          >
            <AnimalArt animal={animal.id} />
            <span>{animal.name}</span>
            {value === animal.id && (
              <CheckCircle className="selected-check" weight="fill" size={20} />
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        className="icon-button close"
        aria-label="Close"
        onClick={onClose}
      >
        <X size={22} />
      </button>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
export function App() {
  const [first, setFirst] = useState<Animal>("unicorn");
  const [second, setSecond] = useState<Animal>("dinosaur");
  const [powerId, setPowerId] = useState<PowerId>("bubbles");
  const idea = powers.find((p) => p.id === powerId)!.idea;
  const [creature, setCreature] = useState<Creature>(sample);
  const [collection, setCollection] = useState<Creature[]>([]);
  const [status, setStatus] = useState<Status>();
  const [jobId, setJobId] = useState<string>();
  const [page, setPage] = useState<"play" | "collection" | "world">("play");
  const [focusWorldCreature, setFocusWorldCreature] = useState(false);
  const [modal, setModal] = useState<"about" | "parents" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [sound, setSound] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const resultRef = useRef<HTMLElement>(null);
  const busy = !!jobId || starting || finishing;
  const audioRef = useRef<ReturnType<typeof createWorldAudio> | null>(null);
  audioRef.current ??= createWorldAudio();
  useEffect(() => {
    audioRef.current?.enable(sound);
  }, [sound]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) audioRef.current?.silence();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      audioRef.current?.dispose();
    };
  }, []);
  function chime(power?: PowerId) {
    audioRef.current?.pause(false);
    audioRef.current?.play(power === "music" ? "note" : "magic");
  }
  useEffect(() => {
    let ignore = false;
    Promise.all([
      request<Status>("/api/status"),
      request<Creature[]>("/api/creatures"),
    ])
      .then(([next, saved]) => {
        if (ignore) return;
        setStatus(next);
        setCollection(saved);
        if (next.activeJob) setJobId(next.activeJob);
      })
      .catch(() => {
        if (!ignore)
          setError(
            browserStorage
              ? "Your saved game could not open. Try a normal browser tab with storage enabled."
              : "The local game helper is not connected. Ask a grown-up to restart the game.",
          );
      });
    return () => {
      ignore = true;
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!jobId) return;
    let ignore = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const job = await request<Job>(`/api/jobs/${jobId}`);
        if (ignore) return;
        setElapsed(
          Math.max(
            0,
            Math.floor((Date.now() - new Date(job.startedAt).getTime()) / 1000),
          ),
        );
        if (job.status === "complete" && job.creature) {
          let made = job.creature;
          setCreature(made);
          setCollection((previous) => [
            made,
            ...previous.filter((c) => c.id !== made.id),
          ]);
          try {
            made = await finishScene(made);
          } catch {
            throw new Error(
              "Your landscape is saved. Use Finish my picture to place your friend without generating again.",
            );
          }
          if (ignore) return;
          setCreature(made);
          setFirst(made.first);
          setSecond(made.second);
          setPowerId(powerFor(made).id);
          setCollection((previous) => [
            made,
            ...previous.filter((c) => c.id !== made.id),
          ]);
          setJobId(undefined);
          setNotice("Your new friend is saved in My Creatures!");
          if (window.innerWidth < 850)
            resultRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
        } else if (job.status === "failed") {
          setError(job.error || "The magic needs another try.");
          setJobId(undefined);
        } else timer = setTimeout(poll, 250);
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Connection lost. Refresh to check your picture.",
          );
          setJobId(undefined);
        }
      }
    }
    void poll();
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [jobId]);
  async function finishScene(made: Creature): Promise<Creature> {
    if (!made.scene || made.scene.portrait) return made;
    setFinishing(true);
    try {
      const { renderPortrait } = await import("./world/portrait");
      const picture = await renderPortrait(made);
      const connection = await request<Status>("/api/status");
      return await request<Creature>(`/api/creatures/${made.id}/portrait`, {
        method: "PUT",
        headers: {
          "Content-Type": "image/png",
          "X-Game-Token": connection.token,
        },
        body: picture,
      });
    } finally {
      setFinishing(false);
    }
  }
  async function retryPortrait() {
    setError("");
    try {
      const saved = await finishScene(creature);
      setCreature(saved);
      setCollection((previous) => [
        saved,
        ...previous.filter((c) => c.id !== saved.id),
      ]);
      setNotice("Your creature scene is saved!");
    } catch {
      setError(
        "Your landscape is saved. Finish the picture to try placing your creature again—no new generation is needed.",
      );
    }
  }
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setStarting(true);
    setElapsed(0);
    chime();
    try {
      const connection = await request<Status>("/api/status");
      setStatus(connection);
      if (connection.activeJob) {
        setJobId(connection.activeJob);
        return;
      }
      const job = await request<Job>("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Game-Token": connection.token,
        },
        body: JSON.stringify({ first, second, idea, powerId }),
      });
      setJobId(job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setStarting(false);
    }
  }
  function surprise() {
    const a = Math.floor(Math.random() * animals.length);
    const b =
      (a + 1 + Math.floor(Math.random() * (animals.length - 1))) %
      animals.length;
    setFirst(animals[a].id);
    setSecond(animals[b].id);
    setPowerId(powers[Math.floor(Math.random() * powers.length)].id);
    chime();
  }
  function showCreature(c: Creature) {
    setCreature(c);
    setFirst(c.first);
    setSecond(c.second);
    setPowerId(powerFor(c).id);
    setPage("play");
  }
  const allCreatures = [sample, ...collection];
  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="brand">
          <h1>
            <span>Silly</span> <span>Animal</span> <span>Machine</span>
          </h1>
          <p>
            Pick two animals, choose a power, and make a magical new creature!
          </p>
        </div>
        <div className="motto">
          Silly ideas.
          <br />
          Brighter days! <Heart weight="fill" size={22} />
        </div>
      </header>
      <nav aria-label="Main navigation">
        <button
          aria-label="Home"
          className="home-button"
          onClick={() => setPage("play")}
        >
          <House weight="fill" size={26} />
        </button>
        <button
          className={page === "play" ? "nav-active" : ""}
          onClick={() => setPage("play")}
        >
          Play
        </button>
        <button
          className={page === "collection" ? "nav-active" : ""}
          onClick={() => setPage("collection")}
        >
          My Creatures <span className="count">{allCreatures.length}</span>
        </button>
        <button
          className={page === "world" ? "nav-active" : ""}
          onClick={() => {
            setFocusWorldCreature(false);
            setPage("world");
          }}
        >
          My World
        </button>
        <button onClick={() => setModal("about")}>About</button>
        <div className="nav-spacer" />
        <button
          className="icon-button"
          aria-label={sound ? "Turn sound off" : "Turn sound on"}
          aria-pressed={sound}
          onClick={() => {
            audioRef.current?.enable(!sound);
            setSound(!sound);
          }}
        >
          {sound ? <SpeakerHigh size={22} /> : <SpeakerSlash size={22} />}
        </button>
        <button className="parents-button" onClick={() => setModal("parents")}>
          <GearSix size={19} /> Grown-ups
        </button>
      </nav>
      {error && (
        <div role="alert" className="error-banner">
          <span>{error}</span>
          <button
            className="icon-button"
            onClick={() => setError("")}
            aria-label="Dismiss message"
          >
            <X size={20} />
          </button>
        </div>
      )}
      {page === "world" ? (
        <Suspense
          fallback={
            <main className="panel" role="status" style={{ padding: 40 }}>
              Opening Pocket Creature World…
            </main>
          }
        >
          <PocketWorld
            key={creature.id}
            creature={creature}
            focusCreature={focusWorldCreature}
            creatures={allCreatures}
            onBack={() => setPage("collection")}
            onSound={(event) => audioRef.current?.play(event)}
            onAudioPause={(value) => audioRef.current?.pause(value)}
          />
        </Suspense>
      ) : page === "play" ? (
        <main className="game-layout">
          <section
            className="panel recipe-panel"
            aria-label="Make your creature"
          >
            <form onSubmit={generate}>
              <AnimalPicker
                step={1}
                value={first}
                other={second}
                onChange={setFirst}
                disabled={busy}
              />
              <AnimalPicker
                step={2}
                value={second}
                other={first}
                onChange={setSecond}
                disabled={busy}
              />
              <fieldset className="idea-section power-picker" disabled={busy}>
                <legend>
                  <span className="step-number">3</span> Choose a Power
                </legend>
                <div className="power-options">
                  {powers.map((power) => (
                    <label
                      key={power.id}
                      className={powerId === power.id ? "power-selected" : ""}
                    >
                      <input
                        type="radio"
                        name="power"
                        value={power.id}
                        checked={powerId === power.id}
                        onChange={() => setPowerId(power.id)}
                      />
                      <span aria-hidden="true">{power.icon}</span>
                      <span>{power.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                className="generate-button big-button"
                type="submit"
                disabled={busy || !idea.trim()}
              >
                {busy ? (
                  <CircleNotch className="spin" size={32} />
                ) : (
                  <MagicWand weight="fill" size={35} />
                )}
                {busy ? "Making a little magic…" : "Generate My Creature!"}
              </button>
              <div className="recipe-footer">
                <span>
                  <Sparkle size={15} weight="fill" /> Powered by imagination
                </span>
                <button type="button" disabled={busy} onClick={surprise}>
                  <Shuffle size={17} /> Surprise me
                </button>
              </div>
            </form>
          </section>
          <section
            className="panel creature-panel"
            aria-label="Your magical creature"
            ref={resultRef}
            aria-busy={busy}
          >
            <h2>
              <Star className="gold-star" weight="fill" /> Your Magical
              Creature! <Star className="gold-star" weight="fill" />
            </h2>
            <div className="creature-stage">
              {creature.scene && !creature.scene.portrait ? (
                <div className="scene-pending">
                  <Sparkle size={40} />
                  <p>Your landscape is ready.</p>
                  {!busy && (
                    <button onClick={() => void retryPortrait()}>
                      Finish my picture
                    </button>
                  )}
                </div>
              ) : (
                <img
                  className="creature-image"
                  src={assetUrl(creature.image)}
                  alt={`${creature.name}, a magical ${creature.first} and ${creature.second} mix`}
                />
              )}
              {!busy && (!creature.scene || creature.scene.portrait) && (
                <div className="art-sticker">
                  Made of
                  <br />
                  happy thoughts!
                  <Heart weight="fill" size={20} />
                </div>
              )}
              {busy && (
                <div className="making-overlay" role="status">
                  <MagicWand size={54} weight="fill" className="wand" />
                  <h3>
                    {finishing
                      ? "Placing your friend and its power…"
                      : "Choosing a little world…"}
                  </h3>
                  <p>Adding your friend, its power, and a sprinkle of magic.</p>
                  <p>This picture is made right here on your computer.</p>
                  <span className="loading-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  {elapsed > 180 && (
                    <p>Still working. You can leave this page open.</p>
                  )}
                </div>
              )}
              <span className="image-caption">
                {creature.id === sample.id
                  ? "Meet your first magical friend"
                  : "A brand-new friend, made by you"}
              </span>
            </div>
            <div className="creature-details" aria-live="polite">
              <Star weight="fill" className="detail-star" size={30} />
              <dl>
                <div>
                  <dt>Name:</dt>
                  <dd className="creature-name">{creature.name}</dd>
                </div>
                <div>
                  <dt>Power:</dt>
                  <dd>{creature.idea}</dd>
                </div>
                <div>
                  <dt>Description:</dt>
                  <dd>{creature.description}</dd>
                </div>
              </dl>
              <Heart className="detail-heart" size={36} weight="fill" />
            </div>
            <div className="creature-actions">
              <button
                className="play-button big-button"
                disabled={
                  busy || !!(creature.scene && !creature.scene.portrait)
                }
                onClick={() => {
                  setFocusWorldCreature(true);
                  setPage("world");
                  chime();
                }}
              >
                <Play size={25} weight="fill" />
                Play with my creature
              </button>
              {(!creature.scene || creature.scene.portrait) && (
                <a
                  className="download-button"
                  href={assetUrl(creature.image)}
                  download={`${creature.name}.png`}
                  aria-label={`Download ${creature.name}'s picture`}
                >
                  <DownloadSimple size={25} />
                </a>
              )}
            </div>
            <p className="saved-note">
              <Heart size={14} weight="fill" />{" "}
              {creature.id === sample.id
                ? "Your first friend is ready to play. What will you make next?"
                : "Saved in My Creatures. Come back and play anytime."}
            </p>
          </section>
        </main>
      ) : (
        <main className="panel collection-panel">
          <div className="collection-title">
            <div>
              <p className="eyebrow">A LITTLE WORLD OF YOUR OWN</p>
              <h2>My Magical Creatures</h2>
              <p>Every silly idea deserves a friend.</p>
            </div>
            <button className="play-button" onClick={() => setPage("play")}>
              <MagicWand size={22} /> Make a creature
            </button>
          </div>
          <div
            className="collection-grid"
            tabIndex={0}
            role="region"
            aria-label="Saved creatures"
          >
            {allCreatures.map((c) => (
              <button
                className="collection-card"
                key={c.id}
                onClick={() => showCreature(c)}
              >
                {c.scene && !c.scene.portrait ? (
                  <div className="scene-card-pending">
                    Finish my picture <Sparkle size={32} />
                  </div>
                ) : (
                  <img
                    loading="lazy"
                    src={assetUrl(c.image)}
                    alt={`${c.first} and ${c.second} creature`}
                  />
                )}
                <div>
                  <h3>{c.name}</h3>
                  <p>{c.idea}</p>
                  <span>
                    {c.id === sample.id ? "Your starter friend" : "Made by you"}{" "}
                    <Heart weight="fill" size={15} />
                  </span>
                </div>
              </button>
            ))}
          </div>
          {busy && (
            <p role="status" className="collection-pending">
              <CircleNotch className="spin" /> Another little friend is on the
              way…
            </p>
          )}
        </main>
      )}
      <footer>
        <Flower size={19} weight="fill" />
        <span>Play</span>
        <b>·</b>
        <span>Imagine</span>
        <b>·</b>
        <span>Be silly</span>
        <b>·</b>
        <span>Repeat!</span>
        <Heart size={20} weight="fill" />
      </footer>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle weight="fill" size={23} />
          {notice}
        </div>
      )}
      {modal === "about" && (
        <Modal title="Little ideas. Big magic." onClose={() => setModal(null)}>
          <p>
            Choose two different animals, choose a special power, and press the
            big green button. Your animal mix becomes a 3D friend, and the
            machine picks a landscape and adds your friend and its power!
          </p>
          <ol>
            <li>Pick your two favourite animals.</li>
            <li>Choose bubbles, flowers, music, or shooting stars.</li>
            <li>Make your creature, then visit its Pocket Creature World.</li>
          </ol>
          <p>
            Feed your friend, play ball, and try its special power in the
            garden. Friendship flowers stay saved in this browser. New scenes
            use your animal mix’s 3D model. Older saved drawings are kept as
            picture friends. Your friends live in <strong>My Creatures</strong>.
            There are no scores to lose and no wrong ideas. Just play, imagine,
            and be kind.
          </p>
        </Modal>
      )}
      {modal === "parents" && (
        <Modal
          title="A little note for grown-ups"
          onClose={() => setModal(null)}
        >
          <div className={`connection ${status?.ready ? "connected" : ""}`}>
            <CheckCircle size={25} weight="fill" />
            <span>{status?.message || "Checking the local helper…"}</span>
          </div>
          <p>
            New pictures are made locally from ten bundled landscapes, the
            selected 3D animal model, and its special power. No ChatGPT sign-in,
            API key or generation credits are needed to play.
          </p>
          <p>
            The game randomly picks a landscape each time and avoids repeating
            the last one. Your saved pictures keep the same landscape and power.
          </p>
          <p>
            {browserStorage ? (
              "Creatures, pictures and worlds are saved in this browser on this device. They do not sync between phones. Clearing this site's data or using private browsing can remove your collection. Internet is needed to load the game and its models."
            ) : (
              <>
                Creatures and pictures are saved in the <code>.local</code>{" "}
                folder on this Mac. Keep that folder to keep your collection.
              </>
            )}
          </p>
          <p>
            The landscapes were illustrated once during development. Making a
            creature now only renders and saves a picture on your device.
          </p>
        </Modal>
      )}
    </div>
  );
}
