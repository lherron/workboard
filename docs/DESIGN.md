# Design Philosophy

## North Star

webwrkq is a **browser UI for the `wrkq` CLI**. The interface should feel like a natural extension of the terminal, not a departure from it. We're building a GUI that respects CLI conventions and aesthetics, not replacing them with typical web application patterns.

## Core Principles

### 1. Terminal Authenticity

The UI should feel like a terminal, not just look like one. This means:

- **Text-based interactions** over graphical buttons and controls
- **CLI-style prompts and syntax** (e.g., `$ wrkq ls m3`, `› new task`)
- **ASCII box-drawing characters** for structure and hierarchy
- **Monospace typography** throughout for consistency with terminal output
- **Muted color palettes** inspired by actual terminal emulators (xterm, iTerm)

The goal is not to recreate a terminal emulator, but to preserve the terminal's directness and information density in a web context.

### 2. Restraint Over Decoration

Every visual element should serve a functional purpose. Avoid:

- Rounded corners and soft shadows (prefer sharp edges)
- Colorful accent pills and badges (prefer symbols and plain text)
- Animated transitions and micro-interactions (prefer immediate feedback)
- Busy backgrounds and gradients (prefer solid colors or subtle textures)

When in doubt, remove rather than add.

### 3. Information Density

The CLI is information-dense by necessity. The web UI should match this:

- **Compact spacing** that respects the user's screen real estate
- **Inline metadata** presented as flags and symbols (e.g., `─` for low priority, `●` for done)
- **Hierarchical indentation** using space, not color or size
- **Tabular layouts** for lists and structured data

Users come to `wrkq` to manage tasks efficiently, not to be delighted by animations.

### 4. Escape Generic AI Aesthetics

Avoid the common pitfalls of AI-generated design:

- **No default font stacks** (Inter, Roboto, system fonts)
- **No purple gradients on white backgrounds**
- **No cookie-cutter component libraries** used without modification
- **No unnecessary decoration** to make things "pop"

Choose distinctive, contextually appropriate fonts and colors that feel intentional, not algorithmic.

### 5. Text as Interface

Buttons, links, and controls should be **words and symbols**, not boxes to click:

- Prefer `cancel | save` over `[Cancel] [Save]`
- Prefer `--sort Priority` over a dropdown menu
- Prefer `+ new` over a floating action button
- Prefer `esc` over an `×` icon

The interface should read like a script, not a control panel.

## Implementation Guidelines

- **Forms**: Simple text inputs with minimal borders, styled like terminal prompts
- **Navigation**: Tree views with ASCII characters, not expand/collapse icons
- **Actions**: Text links with hover states, not raised buttons
- **Feedback**: Inline text messages, not toast notifications
- **States**: Symbols and abbreviations (○ ◐ ● ◌), not color-coded badges

## Anti-Patterns

Avoid these common web UI patterns:

- ❌ Floating action buttons
- ❌ Card-based layouts with heavy shadows
- ❌ Color-coded priority/status indicators
- ❌ Icon-only buttons
- ❌ Modal dialogs with rounded corners and overlays
- ❌ Dropdown menus for simple selections

## Success Metrics

The design is successful when:

1. A CLI-first user feels **at home** in the browser UI
2. The interface **disappears** and lets the task data take focus
3. Visual hierarchy is achieved through **spacing and typography**, not color
4. The aesthetic feels **cohesive** with the terminal, not foreign to it

---

This is a living document. As the UI evolves, these principles should be revisited and refined, but the north star remains constant: **respect the terminal, respect the user's time, respect simplicity.**
