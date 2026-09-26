export const backgrounds = [
  "sunny-meadow",
  "enchanted-forest",
  "seaside-cove",
  "cherry-garden",
  "snowy-valley",
  "candy-hills",
  "rainbow-waterfall",
  "autumn-orchard",
  "cloud-garden",
  "fairy-village",
].map((id) => ({ id, url: `/assets/backgrounds/${id}.jpg` }));

/** Avoid an immediate repeat, including after restarting the local helper. */
export function chooseBackground(previous?: string, random = Math.random) {
  const choices = backgrounds.filter(
    (background) => background.id !== previous,
  );
  return choices[
    Math.min(
      choices.length - 1,
      Math.max(0, Math.floor(random() * choices.length)),
    )
  ];
}
