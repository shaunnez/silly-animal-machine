import { assetUrl } from "../asset-url";
import { useEffect, useRef, useState } from "react";
import type { Creature } from "../game";
import { planets, type PlanetId } from "./planets";

export type Flight = { friend: Creature; from: PlanetId; to: PlanetId };
export function SpaceTrip({
  flight,
  onArrive,
}: {
  flight: Flight;
  onArrive: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const arrive = useRef(onArrive);
  arrive.current = onArrive;
  useEffect(() => {
    let frame = 0,
      elapsed = 0,
      last = performance.now();
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 350
      : 4200;
    const tick = (now: number) => {
      if (!document.hidden) elapsed += Math.min(50, now - last);
      last = now;
      setProgress(Math.min(1, elapsed / duration));
      if (elapsed >= duration) arrive.current();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [flight]);
  return (
    <div className="space-trip" role="status" aria-live="polite">
      <div className="space-trip-title">
        <p>A LITTLE SPACE ADVENTURE</p>
        <h3>
          {flight.friend.name} is flying to {planets[flight.to].name}!
        </h3>
      </div>
      <div className="space-route" aria-hidden="true">
        <span className="departure-planet">{planets[flight.from].icon}</span>
        <span className="arrival-planet">{planets[flight.to].icon}</span>
        <div
          className="friend-spaceship"
          style={{
            left: `${8 + progress * 68}%`,
            top: `${48 - Math.sin(progress * Math.PI) * 23}%`,
            transform: `rotate(${Math.cos(progress * Math.PI) * -12}deg)`,
          }}
        >
          <div className="ship-flame" />
          <div className="ship-hull">
            <img src={assetUrl(flight.friend.image)} alt="" />
          </div>
          <div className="ship-fin" />
        </div>
      </div>
      <p>
        {progress < 0.25
          ? "Buckle up, little explorer…"
          : progress < 0.8
            ? "Past the stars and over the moon!"
            : "Landing in a brand-new playground…"}
      </p>
    </div>
  );
}
