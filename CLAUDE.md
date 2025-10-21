# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Rhythm Planner** is a local-first, warm-minimalist life-management app that organizes work, chores, errands, and personal time into color-coded Pomodoro-style blocks. It helps users "live in rhythm, not on a list" by batching tasks into focused time blocks while respecting weekly budgets and daily energy levels.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Database**: Dexie.js (IndexedDB wrapper) - all data stored locally in browser
- **Styling**: TailwindCSS with warm minimalist design system
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **No backend** - completely offline-first

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Architecture Overview

### Database Schema (src/db/database.ts)

The app uses Dexie.js with four main tables:

1. **tasks** - Core task entities with domain, priority, energy level, recurrence patterns, and dread tracking
2. **blockTypes** - Predefined Pomodoro block templates (Deep 60, Routine 30, Light 15, etc.)
3. **sessions** - Historical records of completed/skipped work sessions
4. **userPrefs** - User preferences including weekly caps, domain colors, and permission rules

Key indexes: `tasks` indexed by domain, status, priority, deadline, recurrence, snoozedUntil for efficient filtering.

### Core Domains & Color System

Five domains with assigned hex colors (see src/utils/domainColors.ts):

- **Work**: #3A5BA0 (blue)
- **Chore**: #8FAE8F (sage green)
- **Errand**: #D6A656 (gold)
- **Personal**: #D58B7C (coral)
- **Creative**: #A88FB0 (purple)

Domain colors are used consistently across the UI for visual task categorization.

### Task Recommendation Engine (src/utils/taskRecommender.ts)

Scores tasks using weighted formula:
```
score = 0.35*urgency + 0.30*value + 0.20*energyFit + 0.15*timeFit - dreadPenalty + varietyBonus
```

- **urgency**: Based on deadline proximity
- **value**: Derived from priority level
- **energyFit**: Matches task energy requirement to user's current energy
- **timeFit**: Whether task fits in available time
- **dreadPenalty**: 0.1 per skip (tracks avoidance behavior)
- **varietyBonus**: +0.15 if different domain than last task

### Skip Logic & Dread System

When user skips a task:
1. Increment task's `dread` counter
2. Set `snoozedUntil` to 90 minutes from now
3. Show 3 alternative tasks scored by recommender
4. If no selection in 30s, auto-suggest 5-min micro-task
5. Track skip in session history

This prevents repeat skipping while offering productive alternatives.

### Energy-Based Workflow

Users select current energy level (Low/Medium/High) which filters:
- Dashboard recommendations
- Block type suggestions
- Task scoring (preferring tasks matching current energy)

Energy is a first-class citizen in the UI - always visible in sidebar.

## Component Structure

### Main App (src/App.tsx)

- Manages global state: current view, active task, timer state, energy level
- Renders sidebar navigation (Dashboard / Task Library / Settings)
- Orchestrates modal overlays (Timer, Skip Replacement)
- Initializes database on mount

### Dashboard (src/components/Dashboard.tsx)

- Shows daily/weekly progress stats
- Quick-start buttons per domain
- Top 5 recommended tasks for current energy
- Energy selector at top right

### Timer (src/components/Timer.tsx)

- Circular Pomodoro countdown with SVG progress ring
- Domain-colored border and accent
- Start/Pause/Resume controls
- "Not This" button triggers skip logic
- Plays soft audio chimes on start/complete
- Creates session records in database

### SkipReplacementModal (src/components/SkipReplacementModal.tsx)

- Displays 3 alternative tasks when user skips
- 30-second countdown to auto-fallback
- Each task card shows domain, energy, time, priority
- Click to immediately start replacement task

### TaskLibrary (src/components/TaskLibrary.tsx)

- Filterable list by domain/priority/energy
- Add/Edit/Delete tasks via modal
- Shows dread score if task has been skipped
- Supports recurring vs one-time tasks

### Settings (src/components/Settings.tsx)

- Configure weekly work hour cap
- Customize domain colors (color pickers)
- Permission rules (soft cap, hard cap, recovery mode)
- Export/Import full data as JSON backup

## Design System (Warm Minimalist)

- **Font**: Inter (400, 600, 700 weights from Google Fonts)
- **Base background**: #F9FAFB
- **Border radius**: 0.5rem default
- **Shadow**: 0 1px 3px rgba(0,0,0,0.1)
- **Internal padding**: 1.25rem (spacing-internal)
- **Hover state**: 8-10% darker shade of accent color
- **Animations**: Subtle fades and scales via Framer Motion

Keep visual hierarchy clean: white cards on light gray background, domain colors as accents only.

## Key Data Flow Patterns

### Starting a Task Session

1. User clicks "60 min" on recommended task
2. App sets `activeTask` + `blockDuration` state
3. Shows Timer modal
4. Timer creates session record in DB with `completed: false`
5. On completion: updates session with `earnedMins`, marks task done if `recurrence === 'Once'`

### Weekly Budget Enforcement

- `calculateWeeklyMinutes('Work')` sums last 7 days of completed Work sessions
- Dashboard shows progress bar vs `userPrefs.maxWorkHoursPerWeek`
- If `permissionRules.hardCap` enabled, block new Work sessions when over limit
- If `permissionRules.softCap` enabled, show warning but allow

### Recurring Task Handling

- `recurrence: 'Once'` → task marked `status: 'done'` after completion, removed from recommendations
- `recurrence: 'Daily'|'Weekly'|etc.` → task stays `status: 'todo'` forever, reappears daily

## Adding New Features

### Adding a New Domain

1. Update `Domain` type in src/db/database.ts
2. Add color to src/utils/domainColors.ts
3. Add to Tailwind config's domain colors
4. Add icon mapping in Dashboard.tsx `domainIcons`
5. Update Settings color pickers

### Adding a New Block Type

1. Add entry to `initializeDefaultBlockTypes()` in src/db/database.ts
2. Assign appropriate duration, break time, energy range, domain

### Modifying Task Scoring

Edit scoring formula in src/utils/taskRecommender.ts `scoreTask()`. Ensure weights sum to ~1.0 before penalties/bonuses.

## Important Notes

- **All data persists in IndexedDB** - no server required
- **No user accounts** - single-user local app
- **Export/Import** via Settings for backups
- **Audio feedback** uses Web Audio API (simple oscillator tones)
- **Modal z-index** is 50 to ensure overlays appear above sidebar (z-40)
- **Animations** should remain subtle - this is a productivity tool, not a game

## Browser Compatibility

Requires modern browser with IndexedDB and Web Audio API support (Chrome, Firefox, Edge, Safari 14+).
