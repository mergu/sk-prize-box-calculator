# Spiral Knights Prize Box Calculator

A small static web page for working out whether a Spiral Knights prize box is worth opening. Enter the box's Crown cost, its loot pools and the items in each pool, and it shows the expected value (EV), expected profit or loss, ROI and per-item drop chances.

It's plain HTML, CSS and JavaScript, with no build step and no dependencies.

## Files

- `index.html`: the page
- `style.css`: the dark theme and layout
- `app.js`: data handling, calculations and rendering

## Run locally

Open `index.html` in a browser. To serve it instead:

```sh
python3 -m http.server
```

Then go to http://localhost:8000.

## Host on GitHub Pages

1. Create a GitHub repository and push these files to the root of the `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, then pick `main` and `/ (root)`.
4. Save. The site will be live at `https://<username>.github.io/<repo>/` after a minute or so.

## How it works

- Each **pool** has a drop chance (%) per box. Pool chances should total 100%; the page warns you if they don't.
- Each **item** has a weight. Its chance within the pool is its weight divided by the pool's total weight, so you can enter relative weights (1, 1, 2) or percentages (25, 25, 50).
- An item's **drop chance** is the pool chance × its chance within the pool.
- **EV** = sum of (drop chance × value) over all items. **Profit** = EV − cost. **ROI** = profit ÷ cost.
- **Chance of item worth > cost** is the total drop chance of every item valued above the box cost. Those items are highlighted in green.

Example: a pool with a 5% chance holding Item A (100,000 cr, weight 1) and Item B (500,000 cr, weight 1) gives each item a 2.5% drop chance per box. The pool adds 0.025 × 100,000 + 0.025 × 500,000 = 15,000 cr to the box's EV.

## Data

Prize boxes save automatically to your browser's `localStorage`. Use **Export** to download them as JSON, and **Import** to load a JSON file. Imported boxes are added to your list; nothing already there is replaced.

The JSON format:

```json
{
  "boxes": [
    {
      "name": "Example box",
      "cost": 25000,
      "pools": [
        {
          "name": "Rare",
          "chance": 5,
          "items": [
            { "name": "Item A", "value": 100000, "weight": 1 },
            { "name": "Item B", "value": 500000, "weight": 1 }
          ]
        }
      ]
    }
  ]
}
```
