# MUI Migration Progress

## Overview

Migrating HanLearn's frontend from custom CSS Modules to Material UI (MUI). The goal is to replace all custom UI components and styling with MUI equivalents while preserving all existing functionality.

**Visual approach**: Keep existing color palette (#AA381E brown/red, #E6E0AE gold/beige) and layout, but let MUI defaults handle shapes, spacing, and elevation.

---

## Phase 0: Setup & React Upgrade — COMPLETED

- Upgraded React from `16.13.1` to `^18.2.0` (using `createRoot` API)
- Installed MUI v7 packages: `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`
- Created `web-client/src/theme.ts` with custom palette, typography, and component overrides
- Wrapped app in `<ThemeProvider>` + `<CssBaseline />` in `web-client/src/index.tsx`
- Build verified

### Files modified
- `web-client/package.json`
- `web-client/src/index.tsx`
- `web-client/src/theme.ts` (new)

---

## Phase 1: Shared UI Components — COMPLETED

Replaced all custom UI components in `components/UI/` with MUI equivalents.

| Component | MUI Replacement | Status |
|-----------|----------------|--------|
| Button | `MUI Button` (variant="contained", color mapping) | Done |
| PictureButton | `MUI IconButton` with background color | Done |
| Buttons | `MUI Stack direction="row"` | Done |
| Input | `MUI TextField` (outlined, size="small") | Done |
| FormInput | `MUI TextField` / `Select` + `MenuItem` | Done |
| Modal | `MUI Dialog` with close `IconButton` | Done |
| Backdrop | `MUI Backdrop` | Done |
| Table | `MUI TableContainer` + `Table` + `TableHead` + `TableBody` | Done |
| TableRow | `MUI TableRow` + `TableCell` | Done |
| Remove | `MUI IconButton` + `CloseIcon` | Done |
| Toggle | `MUI Switch` + `FormControlLabel` | Done |
| Spinner | `MUI CircularProgress` in `Box` | Done |

### Files modified
- `web-client/src/components/UI/Buttons/Button/Button.tsx`
- `web-client/src/components/UI/Buttons/PictureButton/PictureButton.tsx`
- `web-client/src/components/UI/Buttons/Buttons.tsx`
- `web-client/src/components/UI/Input/Input.tsx`
- `web-client/src/components/UI/FormInput/FormInput.tsx`
- `web-client/src/components/UI/Modal/Modal.tsx`
- `web-client/src/components/UI/Backdrop/Backdrop.tsx`
- `web-client/src/components/UI/Table/Table.tsx`
- `web-client/src/components/UI/Table/TableRow/TableRow.tsx`
- `web-client/src/components/UI/Table/TableRow/Remove/Remove.tsx`
- `web-client/src/components/UI/Toggle/Toggle.tsx`
- `web-client/src/components/UI/Spinner/Spinner.tsx`

---

## Phase 2: Navigation & Layout — COMPLETED

Replaced all navigation and layout components with MUI equivalents.

| Component | MUI Replacement | Status |
|-----------|----------------|--------|
| Toolbar | `MUI AppBar` + `Toolbar` | Done |
| SideDrawer | `MUI Drawer` (temporary variant) | Done |
| DrawerToggle | `MUI IconButton` + `MenuIcon` | Done |
| NavigationItem | `MUI Button` with `NavLink` component prop | Done |
| NavigationItems | `MUI Stack` (desktop) / `List` (drawer) | Done |
| Dropdown | `MUI Menu` + `Paper` with `useState` for `anchorEl` | Done |
| Layout | `Box` with fragments (replaced `Aux` HOC) | Done |
| Logo | `Box` with `sx` (replaced CSS module) | Done |

### Files modified
- `web-client/src/components/Navigation/Toolbar/Toolbar.tsx`
- `web-client/src/components/Navigation/SideDrawer/SideDrawer.tsx`
- `web-client/src/components/Navigation/SideDrawer/DrawerToggle/DrawerToggle.tsx`
- `web-client/src/components/Navigation/NavigationItems/NavigationItem/NavigationItem.tsx`
- `web-client/src/components/Navigation/NavigationItems/NavigationItems.tsx`
- `web-client/src/components/Navigation/NavigationItems/Dropdown/Dropdown.tsx`
- `web-client/src/components/Layout/Layout.tsx`
- `web-client/src/components/Logo/Logo.tsx`

---

## Phase 3: Simple Pages — COMPLETED

Migrated auth forms, home page, and chengyu quiz to MUI.

| Component | MUI Replacement | Status |
|-----------|----------------|--------|
| Auth (login) | `Paper` + `Typography` + `Box` | Done |
| Register | `Paper` + `Typography` + `Box` | Done |
| Home/MainBanner | `Box` with background image via `sx` | Done |
| Home/SignUpBanner | `Paper` + `Typography` + `Stack` | Done |
| Home/AccountSummary | `Paper` + `Typography` | Done |
| Home/ExpBanner | `Paper` + `Grid` (two-column responsive) | Done |
| Home/Footer | `Box` + `Typography` + `Divider` + `Link` | Done |
| Home container | `Box` (replaced `Aux` import) | Done |

### Files modified
- `web-client/src/containers/Auth/Auth.tsx`
- `web-client/src/containers/Auth/Register.tsx`
- `web-client/src/components/Home/MainBanner/MainBanner.tsx`
- `web-client/src/components/Home/SignUpBanner/SignUpBanner.tsx`
- `web-client/src/components/Home/AccountSummary/AccountSummary.tsx`
- `web-client/src/components/Home/ExpBanner/ExpBanner.tsx`
- `web-client/src/components/Home/Footer/Footer.tsx`
- `web-client/src/containers/Home/Home.tsx`

---

## Phase 4: Complex Pages — COMPLETED

| Component | MUI Replacement | Status |
|-----------|----------------|--------|
| Settings | `RadioGroup`, `Slider`, `Checkbox`, `FormControlLabel`, `FormGroup`, `Divider` | Done |
| SettingsPage | `Box` + `Paper` + `Typography` | Done |
| Chengyu | `Paper` + `List` + `ListItemButton` (with transition animations via `sx`) | Done |
| AddWords/MainBanner | `Box` + `Typography` | Done |
| AddWords container | `Box` + `Typography` (replaced `Aux` with `<>`) | Done |
| ProgressBar | `MUI LinearProgress` with custom colors via `sx` | Done |
| TestSummary | `IconButton` + `HomeIcon`, `Typography`, replaced `Aux` with `<>` | Done |
| NewWords | `Box` + `Typography` (page layout) | Done |
| NewWord | `Paper` for char card, `Box` for char holder with hover `sx`, replaced `Aux` with `<>` | Done |
| SentenceRead | `Paper` for question card, `Box` with data-attribute popup system, replaced `Aux` with `<>` | Done |
| SentenceWrite | `Box` for layout, `TextField` for sentence input, replaced `Aux` with `<>` | Done |
| TestChengyusTest | `Paper` for char card, `Box` for char holder, `Link`, replaced `Aux` with `<>` | Done |
| Test | `Box`/`Paper`/`Typography` for layout, replaced CSS classes with `sx`, replaced `Aux` with `<>` | Done |

### Files modified
- `web-client/src/components/Settings/Settings.tsx`
- `web-client/src/containers/SettingsPage/SettingsPage.tsx`
- `web-client/src/components/Home/Chengyu/Chengyu.tsx`
- `web-client/src/components/AddWords/MainBanner.tsx`
- `web-client/src/containers/AddWords/AddWords.tsx`
- `web-client/src/components/Test/ProgressBar/ProgressBar.tsx`
- `web-client/src/components/Test/TestSummary/TestSummary.tsx`
- `web-client/src/components/Test/NewWords/NewWords.tsx`
- `web-client/src/components/Test/NewWords/NewWord/NewWord.tsx`
- `web-client/src/components/Test/SentenceRead/SentenceRead.tsx`
- `web-client/src/components/Test/SentenceWrite/SentenceWrite.tsx`
- `web-client/src/components/TestChengyusTest/TestChengyusTest.tsx`
- `web-client/src/components/Test/Test.tsx`

### Implementation notes
- **SentenceRead.tsx** popup system was converted from CSS module class toggling to data-attribute-based inline style visibility toggling (`data-popup` / `data-popup-text` attributes with `style.visibility` manipulation), preserving the same show/hide behavior.
- **NewWord.tsx** and **TestChengyusTest.tsx** share the same `Paper` + hover `Box` char card pattern.
- **Test.tsx** — only UI elements were swapped to MUI; no logic was refactored. HanziWriter canvas kept as-is.

---

## Phase 5: Cleanup — COMPLETED

1. **Deleted all CSS module files** — 40 `.module.css` files removed (all orphaned, no active imports)
2. **Deleted `App.css`** — replaced `<div className="App">` with `<Box sx={{ textAlign: 'center', height: '100%' }}>` in `App.tsx`
3. **Simplified `index.css`** — kept only the body background image rule; `margin`/`padding`/`font-family` handled by CssBaseline + theme
4. **Removed `hoc/` directory** — deleted `Aux.tsx` and `withErrorHandler/` (both unused dead code)
5. **Kept `Backdrop.tsx`** — still actively used in `Test.tsx` as a thin MUI wrapper; CSS module file deleted
6. **Audited all imports** — confirmed zero dead `.module.css`, `App.css`, or `Aux` imports remain; removed CSS module type declarations from `global.d.ts`
7. **Build verified** — `npx vite build` passes cleanly (1068 modules, 3.91s)
8. **Full manual test** — pending user verification

### Files modified
- `web-client/src/App.tsx` — removed `App.css` import, replaced `div.App` with MUI `Box`
- `web-client/src/index.css` — simplified to body background image only
- `web-client/src/types/global.d.ts` — removed CSS module type declarations

### Files deleted
- `web-client/src/App.css`
- `web-client/src/hoc/Aux.tsx`
- `web-client/src/hoc/withErrorHandler/withErrorHandler.tsx`
- 40 `.module.css` files across `components/` and `containers/`

---

## Things That Stay Custom (no MUI equivalent)

- Body background image (`index.css`)
- HanziWriter character drawing canvas
- `contentEditable` table cells in AddWords
- Speech recognition / synthesis integration logic
- Howler.js sound effects

---

## Technical Details

- **React**: `^18.2.0` (upgraded from 16.13.1)
- **MUI**: v7.3.7 (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`)
- **Build tool**: Vite (requires Node 20 via nvm)
- **Build command**: `source ~/.nvm/nvm.sh && nvm use 20 && npx vite build`
- **Theme file**: `web-client/src/theme.ts`
- **Color palette**: Primary `#AA381E`, Secondary `#E6E0AE`, Dialog bg `rgb(46, 66, 66)`
