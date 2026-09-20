# Theme system

One token layer drives both themes. No component should ever contain a hardcoded hex colour, a
`dark:` surface override, or a raw `slate-*` background again.

## 1. How it works

`src/index.css` declares the class-based dark variant and a `@theme inline` block:

```css
@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-card: var(--s-card);   /* ... */
}
:root      { --s-card: #ffffff; }
html.dark  { --s-card: #0d121f; }
```

`@theme inline` makes Tailwind resolve the colour at the *use* site — `.bg-card` compiles to
`background-color: var(--s-card)` — so re-binding `--s-card` under `.dark` flips every utility at
once. Components carry a single class (`bg-card`), not a pair (`bg-white dark:bg-[#0D121F]`), and
there is no specificity race between the theme layer and the `.dark` block.

`src/state/themeBoot.ts` sets the `dark` / `light` class, `color-scheme` and `data-theme` on
`<html>` synchronously at import time (before React renders), so a light-theme user never sees a
dark flash. `theme` is `'dark' | 'light' | 'system'`; `'system'` follows `prefers-color-scheme`
live. The Navbar exposes all three via a segmented `role="radiogroup"` control.

**Tailwind 4.3 note.** Both `@variant name (...)` and `@custom-variant name (...)` are accepted at
the top level for *defining* a variant — verified by compiling a probe stylesheet; both emit
`.dark\:bg-x:where(.dark, .dark *)`. `@custom-variant` is the documented spelling and is what the
file uses.

## 2. Token table

| Utility stem | Light | Dark | Use for |
|---|---|---|---|
| `app` | `#F8FAFC` | `#070A10` | the page ground behind everything |
| `card` | `#FFFFFF` | `#0D121F` | cards, modals, popovers, the navbar/header bar |
| `elevated` | `#F1F5F9` | `#141B2D` | panels, list rows, inputs, hover states inside a card |
| `input` | `#FFFFFF` | `#131927` | form fields that need to read as "typeable" |
| `code` | `#F1F5F9` | `#080C14` | `<pre>` / spec / monospace blocks |
| `line` | `#E2E8F0` | `rgb(255 255 255 / .08)` | default hairline borders, dividers, track fills |
| `line-strong` | `#CBD5E1` | `rgb(255 255 255 / .14)` | emphasised borders, focus rings, hover of `elevated` |
| `fg` | `#0F172A` | `#F1F5F9` | primary text |
| `fg-muted` | `#64748B` | `#94A3B8` | secondary text, labels, icons |
| `fg-subtle` | `#94A3B8` | `#64748B` | placeholders, separators, disabled text |

Every stem yields the whole family: `bg-`, `text-`, `border-`, `divide-`, `ring-`, `from-`/`via-`/
`to-`, plus opacity modifiers (`bg-elevated/60`) and variants (`hover:bg-line`, `dark:bg-card`).

Breakpoint: `--breakpoint-xs: 30rem` (480px) is defined in the same `@theme` block, so `xs:` works
(it was used by `ProjectHeader` and `Navbar` while undefined, which silently dropped those labels).

## 3. Accents used as TEXT

Accent *surfaces* (`bg-purple-500/10`, `border-rose-500/30`, solid `bg-blue-600` buttons) work on
both grounds unchanged — leave them alone. Accent **text** does not: `text-purple-300` on a white
card is unreadable. The rule:

| Dark-theme shade | Write |
|---|---|
| `-200` | `text-X-800 dark:text-X-200` |
| `-300` | `text-X-700 dark:text-X-300` |
| `-400` | `text-X-600 dark:text-X-400` |

Same for prefixed variants: `group-hover:text-purple-700 dark:group-hover:text-purple-300`.
`text-white` is correct **only** on a solid or fully saturated accent background
(`bg-purple-600`, `bg-gradient-to-r from-purple-600 to-indigo-600`). On a translucent accent tint
(`/10`–`/30`) use the accent-as-text rule instead.

A dark-tuned accent *surface* (`bg-rose-950/90`, `from-purple-950/40`) needs a light twin too:
`bg-rose-500/20 dark:bg-rose-950/90`.

## 4. Adding a new surface

1. Add `--s-<name>` to **both** `:root` and `html.dark` in `src/index.css`.
2. Add `--color-<name>: var(--s-<name>);` to the `@theme inline` block.
3. Use `bg-<name>` / `text-<name>` / `border-<name>` in components. Nothing else to do.

Do not add a `.surface-*` component class; plain utilities compose better and keep one lookup path.

### Guard rails

These greps must stay empty over `src/components` and `src/App.tsx`:

```
grep -rn "bg-\[#\|border-white/\|bg-white/\|text-slate-[12]00" src/components src/App.tsx
grep -rn "slate-850\|slate-750" src/components
```

(`slate-850` / `slate-750` are not Tailwind shades at all — they silently rendered as nothing.)
Two deliberate exceptions remain, both correct in either theme: `text-slate-950` on a solid
`bg-amber-400` milestone chip, and a neutral `bg-slate-500/10 … border-slate-500/20` badge.

## 5. `Modal` — `src/components/ui/Modal.tsx`

The single modal shell. It carries the theme chrome *and* the accessibility baseline: `role="dialog"`,
`aria-modal="true"`, `aria-labelledby` (or `aria-label` with a custom header), Escape to close,
backdrop click to close, focus moved into the dialog on open, Tab trapped inside it, focus restored
to the trigger on close.

```tsx
<Modal
  open={isOpen}
  onClose={close}
  title="Create New Design Task"
  subtitle="Define deliverables and backward schedule deadlines."
  size="lg"
  footer={<button type="submit" form={FORM_ID}>Create</button>}
>
  <form id={FORM_ID} onSubmit={…}>…</form>
</Modal>
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `open` | `boolean` | — | `false` renders nothing. Keep the component mounted; do not guard with your own early return. |
| `onClose` | `() => void` | — | Fired by Escape, backdrop click and the header/footer close buttons. |
| `title` | `ReactNode` | — | Accessible name; also rendered in the default header. |
| `icon` | `ReactNode` | — | Rendered before the title. Add `shrink-0`. |
| `subtitle` | `ReactNode` | — | Secondary line under the title. |
| `header` | `ReactNode` | — | Replaces the whole header. The dialog is then named by `aria-label` from `title`, so your markup needs no id. Supply your own close button. |
| `footer` | `ReactNode` | — | Sticky footer row; it never scrolls. |
| `size` | `sm…5xl` | `lg` | Maps to `max-w-*`. |
| `className` | `string` | `''` | Extra classes on the card (e.g. `h-[600px]`). |
| `bodyClassName` | `string` | `overflow-y-auto px-5 py-4` | **Replaces** the body classes. Pass `flex flex-col overflow-hidden` when the body owns its own scroll region. |
| `closeOnBackdrop` | `boolean` | `true` | |
| `initialFocusRef` | `RefObject<HTMLElement \| null>` | — | Focused on open instead of the first focusable element. |

The card is always `bg-card border border-line rounded-2xl shadow-2xl max-h-[85vh]` over a
`bg-black/50 backdrop-blur-sm` backdrop. Do not re-style those — one backdrop, one card colour.

**Submit buttons in the footer:** the footer is outside the `<form>`, so give the form an `id` and
the button `form={THAT_ID}`. `CreateTaskModal` and `CreateProjectModal` both do this.

Users: `settings/SettingsModal`, `CloudPanel`, `CreateTaskModal`, `CreateProjectModal`,
`AiAssistantModal`, `InviteCollaboratorsModal`, and the task inspector in
`RetroplanningTimeline`. `TutorialDrawer` is deliberately **not** a modal — it is a non-blocking
docked panel (`role="complementary"`) that coexists with the app.
