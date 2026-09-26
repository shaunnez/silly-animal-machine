import { sample, creatureName, type Creature, type Animal } from "../game";
const pairs: [Animal, Animal][] = [
  ["unicorn", "cat"],
  ["unicorn", "dog"],
  ["unicorn", "monkey"],
  ["unicorn", "frog"],
  ["unicorn", "elephant"],
  ["unicorn", "penguin"],
  ["unicorn", "lion"],
  ["dinosaur", "cat"],
  ["dinosaur", "dog"],
  ["dinosaur", "monkey"],
  ["dinosaur", "frog"],
  ["dinosaur", "elephant"],
  ["dinosaur", "penguin"],
  ["dinosaur", "lion"],
  ["cat", "dog"],
  ["cat", "monkey"],
  ["cat", "frog"],
  ["cat", "elephant"],
  ["cat", "penguin"],
  ["cat", "lion"],
  ["dog", "monkey"],
  ["dog", "frog"],
  ["dog", "elephant"],
  ["dog", "penguin"],
  ["dog", "lion"],
  ["monkey", "frog"],
  ["monkey", "elephant"],
  ["monkey", "penguin"],
  ["monkey", "lion"],
  ["frog", "elephant"],
  ["frog", "penguin"],
  ["frog", "lion"],
  ["elephant", "penguin"],
  ["elephant", "lion"],
  ["penguin", "lion"],
];
export const catalogue: Creature[] = [
  sample,
  ...pairs.map(([first, second]) => {
    const key = [first, second].sort().join("-");
    const recipe = { first, second, idea: "Shoots rainbow bubbles" };
    return {
      ...recipe,
      id: "catalogue-" + key + "-v1",
      name: creatureName(recipe),
      description:
        "A little friend ready for snacks, games and rainbow bubbles.",
      image: "/assets/catalogue/" + key + ".png",
      createdAt: "2026-09-26T00:00:00Z",
    };
  }),
];
