# Dream Journal Design

## Goal

PR #5 builds **Dream Journal**, the primary dream archive page opened from Dream Home's "查看梦境档案" action. It upgrades the existing diary view without changing DeepSeek, Supabase Auth, cloud sync rules, Dream Home behavior, or the database schema.

## Scope

Dream Journal shows the current user's visible dream records in a calm, mobile-first archive. Logged-in users see the records surfaced by the existing cloud sync controller; logged-out users keep using local browser records. The page supports date groups, live search, simple filters, empty/loading states, and existing Dream Detail navigation.

Out of scope for this PR:

- Timeline
- Calendar
- Favorite / important records
- Trash
- Edit
- Delete
- Growth / Atlas
- Payment / membership
- Database schema changes
- DeepSeek prompt or API changes
- Auth flow changes
- Cloud sync rule changes

## Architecture

Add `src/dreamJournal.js` as the single Dream Journal module. It owns record normalization, grouping, searching, filtering, rendering, and user interactions for the archive page. `src/app.js` remains responsible for existing analysis flows, local/cloud save bridge, and Dream Detail; it only exposes a small app bridge so Dream Journal can receive visible records and open the existing detail view.

The page continues using the existing `data-view="diary"` panel. `src/index.html` updates that panel to the user-visible name **Dream Journal**, adds search/filter controls, and keeps the existing detail section. `src/style.css` extends the Dream Home visual language: generous spacing, cards, subdued borders, mobile-first layout, no table-heavy dashboard treatment.

## Data Flow

1. `dreamSyncController` emits visible records through the existing `onRecordsChange` callback.
2. `app.js` forwards those records to `DreamJournal.controller.setRecords(records)`.
3. `dreamJournal.js` sorts records by date descending, applies the active filter and live search query, groups them by local date, and renders the list.
4. Clicking a record calls the existing `openDreamDetail(recordId, fallbackRecord)` path. No new detail view is created.
5. Search and filter are purely client-side and do not refresh the page.

## User Interface

The diary page becomes:

- Title: `Dream Journal`
- Subtitle: `你的每一个梦，都值得被温柔收藏。`
- Top action: `New Dream`, which navigates to the existing quick dream entry flow.
- Loading copy: `正在整理你的梦境档案……`
- Empty state:
  - `🌙`
  - `你还没有记录任何梦。`
  - `今天开始，`
  - `把梦轻轻放进梦境档案。`
  - Button: `记录第一个梦`

The list groups records under:

- `Today`
- `Yesterday`
- `Earlier This Week`
- `Earlier This Month`
- `Older`

Each record card displays:

- Automatic title
- Date
- `Quick` or `Deep`
- Emotion
- Up to three symbols
- Pending sync status when `syncStatus === "pending_sync"`

Search matches:

- generated title
- raw dream text
- dream summary
- emotion
- symbols

Filters:

- `全部`
- `Quick`
- `Deep`
- `Pending Sync`

## Safety And Privacy

Dream Journal displays only persisted dream record data that is already visible to the current session. It does not query other users directly, does not use `service_role`, and does not bypass Supabase RLS. User dream text is rendered with `textContent` and DOM nodes, never with `innerHTML` string interpolation.

The page does not add any fortune-telling, diagnosis, treatment, future prediction, or fixed-symbol interpretation language.

## Testing

Automated tests cover:

- date grouping in local browser time
- generated title fallback
- `Quick`, `Deep`, and pending filters
- live search across title, raw text, summary, emotion, and symbols
- empty state rendering
- record click forwarding to the existing detail bridge
- safe rendering without assigning `innerHTML`
- controller record updates after cloud sync emits new records

Manual verification covers:

- `npm test`
- `node --check src/app.js`
- `node --check src/dreamJournal.js`
- browser smoke test for public home, Dream Home navigation, Dream Journal layout, search/filter, and detail navigation
