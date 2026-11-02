# Reading list

A personal reading list. Add books with a title and an optional author,
and remove them when you're done. The list is saved in the browser
(`localStorage`), so it is still there after a reload or a restart.

No build step and no dependencies. Open `index.html` in a browser, or serve
the folder with any static server (e.g. `npx serve .`).

## Seeing each state (no code changes)

Open the **"For reviewers: see each state"** panel at the bottom of the page,
or add one of these to the address. A yellow banner shows whenever a demo
setting is active.

| State | How to reach it | What you see |
| --- | --- | --- |
| **Empty** | First visit, or `?reset` (clears your saved list) | Dashed panel with a book icon, an explanation of what the list is for, and an **Add your first book** button |
| **Loading** | Every page load (briefly), or `?delay=4000` to hold it for 4 s | "Loading your reading list…" with a spinner and grey placeholder rows; the add form is disabled |
| **Error (load)** | `?fail=load` – the first load fails, **Try again** succeeds | Red panel with a "!" icon, a heading naming what failed, what to do, and a **Try again** button |
| **Error (save)** | `?fail=save` – adding or removing fails | Red message under the form or above the list saying which book failed and what to do; the list is unchanged |
| **List** | `?seed` adds three sample books to an empty list | Your books, newest first, each with a Remove button |

Settings can be combined, e.g. `?reset&delay=3000` shows loading, then empty.

`?reset` and `?seed` run once and are removed from the address, so a reload
doesn't repeat them.

## How the three states stay distinct

Each state differs in **text**, **visuals** and **what you can do**, so it is
never ambiguous which one you are looking at:

- **Loading** says "Loading…", is grey and animated, and offers no action.
  The add form is disabled so nothing can be saved before the list exists.
- **Error** is red, has an icon, names what failed, says what to do, and offers
  **Try again**.
- **Empty** is calm (dashed outline, accent colour), explains what the list is
  for, and offers the first action.

An empty list and a failed load never look alike: an error is never shown as
"no books".

## Error messages

Each message says what failed and what to do next.

| Cause | Message (summary) | Action offered |
| --- | --- | --- |
| Load request fails | Couldn't load your reading list; check your connection and try again | Try again |
| Browser blocks storage | Can't be opened because site storage is blocked; allow site data, then try again | Try again |
| Saved data is damaged | Couldn't be read; clear it to start a new list | Clear saved list, Try again |
| Add fails | Couldn't add "Title". Your list hasn't changed. + what to do | Add again |
| Remove fails | Couldn't remove "Title". It's still on your list. + what to do | Remove again |
| Storage full | Storage for this site is full; remove some books, then try again | – |

The blocked, damaged and full cases are real failures that can happen with
`localStorage`. The "request didn't finish" case is simulated with `?fail=`.

## Accessibility and keyboard

- Everything is native: a `<form>`, real `<button>`s, labelled inputs.
  Tab order follows the visual order.
- Visible focus on every control via `:focus-visible`.
- State changes are announced through a `role="status"` region ("Loading…",
  "Your reading list is empty.", "Added …"). Save failures use `role="alert"`.
- The list region has `aria-busy="true"` while loading.
- When the focused control disappears (Try again, Remove), focus moves to
  something sensible: the next book, the previous one, or the new state's
  heading. It never falls back to the top of the page.
- A missing title shows an error tied to the field (`aria-invalid`,
  `aria-describedby`), and focus returns to it.
- Each Remove button includes the book title for screen readers
  ("Remove 'Dune'").
- User input is only ever inserted as text, never as HTML.

## Design notes

- **Async store.** `localStorage` is synchronous, but it is wrapped in an async
  `store.load()` / `store.save()` with a short delay (400 ms by default), so
  the app handles waiting and failure the way it would with a network API.
  Moving to a real backend means rewriting only the `store` object in
  `script.js`.
- **Save before showing.** A book appears (or disappears) only after the save
  succeeds, so the screen never shows a list that wasn't stored.
- **One save at a time**, so two quick removals can't overwrite each other.

## Files

- `index.html` – page structure and the reviewer panel
- `styles.css` – layout and the visual treatment of each state
- `script.js` – store, state rendering, add/remove, demo settings
