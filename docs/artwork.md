# Artwork

Created with the built-in image-generation tool using the supplied screenshot as a visual reference. These are local assets, available without generating a picture on every page load.

- `public/assets/world.png`: 1448 × 1086. Prompt: Wide 4:3 cheerful children's browser game background. Soft bright blue sky, white edge clouds, smiling sun at upper left. Light open center for UI. Lower 15 percent rolling green flower meadows with daisies and distant hills. Soft rendered storybook style. No text, panels, UI, animals, people, or logos.
- `public/assets/unisaurus.png`: 1536 × 1024. Prompt: Polished 3:2 children's storybook illustration. Adorable lavender baby dinosaur combined with a unicorn, golden spiral horn, flowing rainbow mane and tail, tiny paws, round belly, sparkling eyes, blowing rainbow bubbles leftward. Whole creature center-right in a flower meadow, turquoise river, waterfall, clouds and distant pink-purple castle. Bright soft 3D style. No words, UI, borders, logos, or other animals.
- `public/assets/animals.png`: 1254 × 1254, nine 418px cells. Prompt: Exact evenly spaced invisible 3×3 atlas. Cute full-body baby unicorn, green dinosaur, orange cat / puppy, monkey, frog / elephant, penguin, lion. White background, soft rounded 3D storybook style, shiny expressive eyes, friendly smiles, isolated subjects, whitespace, no overlap, scenery, borders or words. Returned alpha is retained. The game displays cells using exact atlas positions, without modifying the images.

Icons: Phosphor. Locally bundled fonts: Fredoka and Nunito (Fontsource).

Runtime creature prompts are constructed by `imagePrompt` in `src/game.ts`, using the selected animals and quoted fun idea. The generator uses the same storybook art direction.
