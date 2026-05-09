# Tirion — Project View Spec

## Purpose

Project View is the management lens for project-organized production state.
It shows Work Orders across all Active and Complete Projects in BOM context,
supporting both project-level visibility (where is this project right now?)
and operational drift correction (managers performing direct state edits on
WOs to handle exceptions).

This view answers project-completeness questions — "what's left to do for
this project," "which assemblies are close to ready," "what's blocked" —
in a way that complements (not duplicates) the shop-floor focus of
Operations Lens. Operations Lens organizes by process and shop flow;
Project View organizes by Project and BOM hierarchy.

Project View is also the primary surface for management-driven WO state
edits. Drift correction (rolling back, marking out-of-sequence completions,
adjusting CompletedQty, returning parts to stock) happens here under a
shared confirmation+note modal pattern.

---

## Operational Sequence Position

Project View consumes data produced by the upstream views:

```
Project Creation → Stock Fulfillment → Batching → Execution Lenses
                                              ↓
                                          Project View
                                          Operations Lens
```

It does not produce new Projects or WOs. It does not handle Project metadata
or compilation (Project Creation View). It does not handle batching decisions
(Batching Lens). It does not host the planning-phase Stock Fulfillment
workflow (Stock Fulfillment View). What it does is make WOs visible in their
Project context, with edit affordances appropriate to a management surface.

---

## Scope and Default View

**Default scope:** all WOs from Active and Complete Projects (excluding
Archived). Open, Complete, and Unreleased WOs are shown by default.
**Cancelled WOs are excluded by default**, accessible via "Show Cancelled"
toggle. Unreleased WOs are visible (de-emphasized) so the planner sees the
complete project picture including planning state.

**Default sort:** by Project (compile date, earliest first), then by
Top-Level Reference suffix (.01, .02, .03), then by BOM hierarchy within
each top-level branch.

**Alternative sort:** by Project Due Date (Project order changes; within-
Project order stays the same).

**Default visibility rules:**
- Complete rows are hidden by default (configurable via "Show Complete" toggle)
- Unreleased rows are visible by default but visually de-emphasized
- Cancelled rows are hidden by default (configurable via "Show Cancelled" toggle)
- Blocked rows are always visible regardless of other filters, with prominent
  warning treatment
- Row Indicators per `terminology_lock.md` Cluster 9: Red Flag (Blocker),
  Yellow Flag (Definition Change Flag), White Flag (Supply Order Exception).
  Display order: Red → Yellow → White
- Assembler Review Flag indicator (distinct icon) on Assembly rows with open Assembler Review Flags

When "Show Cancelled" is toggled on, Cancelled WOs appear in the row list
visually distinct (heavy de-emphasis or strikethrough). Their participation
in BOM tree structure is preserved — they remain in their position in the
tree even though they're terminal — so the manager can see what was retired
and where in the structure.

The view is built around a flat row list — one row per WO. There are no
collapsible Project sections or Top-Level Item sub-sections. Project context
is carried by a Project column on each row, with cell shading using the
Project Color. This keeps the row list scannable, sortable, and compatible
with anchor view alignment.

---

## Project Key (Configuration Area)

Above the row list, a configuration area displays a button for every
non-Archived Project in the system. This serves two purposes:

1. **Visual key** — a glance shows which Projects are currently in flight,
   each with its color and number
2. **Filter control** — clicking buttons toggles individual Project visibility
   in the row list

**Per-Project button display:**
- Project Number (e.g., "98324")
- Project Color (background or accent)
- Eye icon: visible (default) / strikethrough when hidden
- Hover reveals "Isolate" option (sets all other Projects to hidden in one click)

**Global controls in the Project Key area:**
- "Show All" button — resets visibility to all Projects shown
- (No "Hide All" — that would empty the view; not a useful state)

**Visual treatment:**
- All non-Archived Projects appear identically (no distinction between
  Active and Complete in the key)
- Archived Projects do not appear in the key at all
- Hidden Projects' buttons remain in place (struck-through) so the user
  can see what's been hidden and toggle them back

**Hard rule:** Project filtering via the Project Key affects which Projects'
WOs appear in the row list. It does not affect which Projects appear in
the key itself — all non-Archived Projects are always present in the key.

---

## Row List

The row list is a flat list of Work Orders. Each row represents one WO.
Batches are not rows — batched WOs appear individually with a batch
reference indicator (see Batches section).

### Columns

The column set is specified here without committing to display order
(column ordering is a UI mockup-stage decision). Per-column visibility
is user-configurable via the Columns control in the view-shaping area
(see View-Shaping Controls below) — not all columns will be visible by
default. The complete column set:

| Column | Source | Notes |
|--------|--------|-------|
| Project | WorkOrder.project + topLevelIndex | Project Number + Top-Level Reference suffix (e.g., "98324.02"). Cell background shaded with Project Color |
| Part Number | Part.partNumber | Monospace, links to Part Form |
| Part Name | Part.partName | |
| WO Quantity | WorkOrder.quantity | Demand quantity |
| Status | derived | Single-signal column (Blocked > active process > Assembly readiness fraction > state name). See Status Column above |
| Routing Grid | derived | Compact (icon-pill) or Expanded (color-edge + text + sub-status) per the global routing toggle. With anchor active, becomes pre/anchor/post columns |
| Sub-Status | active step's subStatus | Operator/manager context for the active step (also surfaces on Status hover) |
| Priority | WorkOrder.priority | Inline editable |
| Due Date | Project.dueDate (denormalized) | Project Due Date — denormalized to WorkOrder for query efficiency |
| Last Activity Date | derived from latest AuditLog | Most recent state change. Surfaces staleness — answers "how long has this been sitting?" |
| Material | Part.materialSpec.materialName | Supports material-driven queries |
| Stock Size | Part.materialSpec.stockSize | |
| Vendor | active Purchase step's vendor or Part.defaultVendor | Vendor-driven queries; shows current step's vendor when relevant, otherwise the Part default |
| Material ETA | active Supply Order's ETA | Visual treatment differentiates outstanding vs. received items — received items shown struck-through or grayed at-a-glance |
| Cumulative Demand | derived: sum across visible Open WOs for this PartID | Cross-project demand awareness — surfaces consolidation opportunities outside Batching |
| CompletedQty | WorkOrder.completedQty | Production-progress awareness |
| Batch Icon | derived from batchId | Indicator that this WO is a batch member; click navigates to side panel batch context and enables inline batch member expansion |

**Columns visible by default (suggested for Rev 1, refinable during UI mockup):**
Project, Part Number, Part Name, WO Quantity, Status, Routing Grid, Priority,
Due Date, Batch Icon

**Columns available but hidden by default (refinable):**
Sub-Status (surfaces on Status hover anyway), Material, Stock Size, Vendor,
Material ETA, Cumulative Demand, CompletedQty, Last Activity Date

The default visible set is the most commonly-used columns. Less-used but
operationally valuable columns are available via the Columns control,
allowing power users to surface what they need without forcing horizontal
scroll for everyone.

**Visual conventions:**

- **Tree indentation** on the Part Number column communicates BOM hierarchy
  when the row list represents complete BOM trees (see Indent Rule below)
- **Row shading** distinguishes Part from Assembly (consistent with Parts
  Master spec)
- **Project color** appears as cell background on the Project column,
  reinforcing visual Project grouping when sorted by Project
- **Material ETA visual treatment:** outstanding ETAs display normally;
  received items display struck-through or grayed. This communicates "what's
  still outstanding" at a glance without needing an additional column
- **WO ID** does not appear on the row — it is shown in the side panel only.
  WO IDs are technical, not operational; the Part Number plus Project context
  identifies a WO operationally
- **ScrapQty** does not appear on the row — it is shown in the side panel.
  Surfaces when needed for production review without consuming row space

### Status Column

The Status column shows one signal per row, in priority order:

1. **Blocked indicator** — overrides everything else, visually prominent
   (warning color, possibly icon)
2. **Active process name** — when the WO has any step in `Ready` or
   `Started` state (e.g., "Machine", "Assemble", "Purchase"). Ready is the
   operationally meaningful trigger — it means "this can be picked up now,"
   which is the same display answer as "someone is working on this"
3. **Assembly readiness fraction** — for an Assembly WO whose ALL routing
   steps are still Waiting (no step has reached Ready yet). Displays as a
   fraction (e.g., "11/15"). The fraction answers "how close to startable"
   exactly when the Assembly is gated by descendant completeness. This
   applies to all Assembly types regardless of which process types are in
   the routing template (welding, kitting, painting, etc. — the gate is
   on the Assembly's routing as a whole, not specifically on an Assemble
   process step)
4. **State name** — for everything else: "Unreleased", "Complete", etc.
   Note: Parts do not display "Waiting" here in normal operation, because
   their first routing step transitions to Ready quickly once prerequisites
   are met (and Ready triggers display rule 2 above)

When an Assembly's first routing step transitions Waiting → Ready (last
component completes), the fraction drops out and the column shows the
active process name. The display follows the state immediately on the
transition; no operator action is required to trigger the column update.

**Hover:** reveals additional detail — full step state, sub-status, Assembly
readiness fraction (when not currently displayed), blocker note (when
Blocked), and other context.

**Hard rule:** Status column shows exactly one signal at a time, by the
priority above. Detail beyond the primary signal lives in hover and the
side panel.

**Hard rule:** The Assembly readiness fraction only appears when ALL of the
Assembly's routing steps are Waiting. The trigger to drop the fraction is
the first step transitioning to Ready, not Started. State changes that are
purely derived (like Waiting → Ready when prerequisites are met) update
the column immediately without operator action.

### Visual State Treatment

- **Unreleased rows:** visually de-emphasized (lighter text, slightly
  desaturated). They are real WOs, not yet operational. Their visibility
  here lets managers see the complete project picture
- **Open rows:** standard visual weight. Sub-state communicated via routing
  pills, step state, and sub-status
- **Complete rows:** retired (greyed/struck). Hidden by default; surfaced
  via toggle
- **Blocked rows:** prominent warning treatment (color + icon). Always
  visible regardless of other filters

**Blocker propagation on Assemblies:** when an Assembly has a Blocked
descendant WO in the same Project, the Assembly row also displays a
"blocked descendant" indicator (subtle but visible). This lets a planner
scanning Assemblies see at a glance that something downstream is broken
without expanding or drilling in.

---

## Indent Behavior (Tree Visualization)

Tree indentation on the Part Number column shows BOM hierarchy when
meaningful. The rule is single and based on whether the row list
represents complete BOM trees.

**Indents render when:**
- Sort is BOM order (default)
- No search Filter mode is active (Find mode is OK — see below)
- Active filters are limited to Project filters and Top-Level Reference
  filters
- Anchor may be active or inactive — anchor is a visual layout, not a
  fragmentation operation

**Indents collapse to flat when:**
- Sort changes to anything other than BOM order (Priority, Due Date,
  Readiness Deficiency, etc.)
- Search Filter mode has any term (matches scatter, parents may not be
  visible)
- Any filter that fragments the tree is active (Status filters, Blocked-
  only, anchor-relative filters like Ready-for-Anchor or Anchor Pending)

**Indents are preserved when:**
- Search Find mode has a term (matches highlighted in the existing list,
  but the list itself isn't fragmented)
- Project filters or Top-Level Reference filters are active (they scope
  which trees show but don't fragment them)
- Anchor is active without anchor-relative filters

**Principle:** Indents are meaningful only when the row list represents a
complete BOM tree (or several complete trees, one per top-level branch).
Project and Top-Level Reference filters scope which trees show but don't
fragment them, so indents stay valid. Other filters and operations break
"list = tree" and make indents misleading. Find mode navigates the list
without changing its membership, so indents are preserved.

When indents collapse, the Project column (with its Top-Level Reference
suffix) carries the structural context the user needs to know which branch
of which Project a row belongs to.

**Hard rule:** Indent rendering follows the single rule above. The system
does not selectively render indents per-row based on visibility of a row's
parent. The choice is binary at the view level: either all rows show indents
(when the rule permits), or none do.

---

## Routing Grid (Compact and Expanded Modes)

The Routing Grid column displays a WO's routing steps with current state.
Two display modes share the same column space, switched by a global toggle
in the view-shaping controls.

**Compact mode (default):**
- Each step rendered as an icon-sized colored pill
- Pill color identifies the ProcessType
- Pill visual treatment communicates step state (filled = Complete,
  outlined = current/active, faint = Waiting, etc.)
- Tight horizontal density — many steps fit in a small column
- Sub-status not visible inline

**Expanded mode:**
- Each step rendered as a wider cell with colored left edge (ProcessType
  color) and process name text
- Sub-status displayed inline for the currently active step (when set)
- Step state communicated through cell visual treatment
- Wider per-step, fewer steps fit per row

**Hard rule:** Routing Grid mode is a view-level toggle, not per-row. All
visible routing displays use the same mode at any given time.

---

## Anchor View

Project View supports the Anchor + Filter system per `anchor_filter_spec.md`.
An anchor is a process step that becomes the visual centerpiece of the
routing display.

**Anchor selector** lives in the view-shaping controls alongside the routing
mode toggle. Ten selections: None + 9 process anchors (all Rev 1
ProcessTypes are anchor-eligible).

**With anchor active:**
- Routing Grid column reorganizes so the anchored step is vertically aligned
  across rows where it appears
- The anchored step is visually emphasized in the routing display
- Full routing path is always shown (no pre/post step count limiting in Rev 1)
- Rows where the anchored process doesn't apply are de-emphasized when no
  filter is active; excluded when any filter is active
- "None" anchor mode falls back to standard inline routing display

**Filter selector** is enabled when anchor is active. Five mutually-exclusive
options:
- None
- Anchor Pending — anchored step exists and is not Complete
- Ready for Anchor — anchored step's prerequisites are all Complete or
  Skipped (anchor in Ready/Started/Blocked, not Waiting)
- Blocked for Anchor — anchored step exists and at least one prerequisite
  is not done (anchor in Waiting)
- Includes Anchor — broadest; anchor exists anywhere in routing

See `anchor_filter_spec.md` for full filter taxonomy and behavior.

**Anchor + filter for non-lens processes:** Weld, Blacken, Paint, and
3D Print are anchor-eligible despite lacking dedicated execution lenses.
This makes Project View (and Operations Lens) the operational coordination
surface for these processes — managers anchor on Weld to coordinate welding
work, anchor on Blacken to track outside-vendor blackening status, etc.

**Indent interaction:** Anchoring alone does not collapse indents (anchor is
visual layout, not tree fragmentation). Anchor-relative filters DO collapse
indents (they fragment the tree by anchor relationship).

---

## Search

The view supports a global search input with two operating modes,
selected via a mode toggle adjacent to the input.

### Filter Mode (Default)

Typing narrows the visible row list to matches. Non-matches disappear from
the view. Combines intersectively with other active filters: a row is shown
only if it matches the search term AND passes all active filters.

When matches are hidden by filters, the view shows a count: "N results
hidden by filters."

Filter mode is treated as a tree-fragmenting operation — indents collapse
when search is active in this mode.

### Find Mode

Typing highlights matches within the existing row list. Non-matches remain
visible (de-emphasized) so the user can scan around matches for context.

Find mode does NOT collapse indents — the row list isn't being fragmented,
just navigated. The user can locate a specific WO in its full BOM context.

### Search Scope

Search is multi-attribute by default — matches against Part Number, Part
Name, Project Number, Top-Level Reference, WO ID, and any other
operationally-relevant attribute.

Mode toggle (Filter / Find) persists during the session.

**UI consideration (deferred to mockup stage):** consider a dropdown
selector adjacent to the search input letting power users constrain search
to specific attributes (Part Number only, Project only, etc.).

**Hard rule:** Search Filter mode is a tree-fragmenting operation —
indents collapse when active. Search Find mode is a tree-navigating
operation — indents do not collapse.

---

## Inline Edits (No Confirmation)

The following edits are made directly inline on a WO row, without
confirmation:

- **Priority** — direct field edit
- **Sub-status** — dropdown selection (or free-text overflow per process
  type) for the active step
- **Operationally meaningful WO fields** — machine assignment, vendor
  override, time estimates, operator assignment, free-text notes, etc.

These edits autosave on blur, write AuditLog entries, and do not affect
WO state. Inline editability matches what's available on the corresponding
process lens (Machining, Purchasing, etc.) — Project View provides one
place to make these edits across all WOs without navigating to individual
process lenses.

---

## State Edits (Confirmation + Note Modal)

State-affecting edits go through a shared confirmation+note modal. This is
the management drift-correction surface — most exception handling lives here.

### What Triggers the Modal

- Step state changes initiated from Project View:
  - Waiting → Started (advance a step ahead of its prerequisites if needed)
  - Started → Complete
  - Started → Blocked
  - Complete → not-Complete (rollback — resets all downstream steps to
    Waiting per existing rollback rules)
  - Skip a step (mark Complete out of sequence — see Inferred Skips below)
- CompletedQty edits (increase or decrease)
- ScrapQty edits
- Demand edits
- Return to Stock (Primitive 3) — special action with cascade implications
  for Assembly stock-fulfillment
- **Cancel (Primitive 5)** — sets WOStatus to Cancelled. Available only on
  leaf WOs (no non-Cancelled descendants). One-way in Rev 1. See
  `definition_change_flag_spec.md` for full Cancel workflow including
  side-effect display, batch removal, and flag auto-resolution
- **WO Split (Primitive 4)** — divides WO into two. Initiates Draft View
  Mode in Project View per `wo_split_spec.md`. Available on Open, non-
  Assembly, unbatched WOs
- **Definition Change Flag resolution** — Dismiss or Accept Change actions
  on flagged WOs. Resolution opens the Definition Change Flag resolution
  modal per `definition_change_flag_spec.md`

### Modal Contents

- **Header:** WO identifying info (WO ID, Part Number, current step name)
- **Change summary:** "Step 3 (Machine) Complete → Started" or
  "CompletedQty: 10 → 8"
- **Side effects:** "This will reset steps 4 and 5 to Waiting" or
  "This will trigger a Blocker because CompletedQty (8) < Demand (10)"
- **From-Stock prompt** (when applicable — see below)
- **Note field** (optional, nullable)
- **Confirm / Cancel** buttons

### From-Stock Prompt

The modal includes a "Is this coming from stock?" prompt when EITHER:
1. The user is marking a step Complete out of sequence on a WO that is not
   yet Complete, OR
2. The user is increasing CompletedQty on an already-Complete WO

If the user answers Yes:
- Stock decrements by the quantity attributed to the change
- Single AuditLog entry captures the combined action: WO state change AND
  stock allocation, with note like "5 stock allocated to WO 43909"

If the user answers No:
- The WO state change happens without stock impact
- The user is declaring reality (parts came from somewhere — production,
  prior runs, etc. — without affecting stock count)

The from-stock prompt does not fire on:
- Normal sequential step completion (operator workflow, not drift correction)
- Demand edits
- Rollbacks
- Sub-status edits
- Other state changes that don't increase apparent quantity satisfied

### Inferred Skips

When a manager marks a step Complete out of sequence on a WO with prior
steps still Waiting, the system infers that the prior steps are Skipped.

Example: WO has 5 steps, all Waiting. Manager marks step 4 Complete.
The system infers steps 1-3 as Skipped. The confirmation modal surfaces
this: "Marking step 4 Complete will also mark steps 1, 2, and 3 as
Skipped."

On confirmation:
- Steps 1-3 transition `Waiting → Skipped` with auto-generated note
  "Inferred skip — step 4 marked Complete in Project View"
- Step 4 transitions to Complete with the manager's note
- Step 5 remains Waiting (downstream of the new Complete state)
- All step state changes happen in one atomic transaction
- Each affected step gets its own AuditLog entry, all referencing the same
  parent management action and same user/timestamp

### Return to Stock (Primitive 3) — Special Behavior

Returning a Complete WO's quantity to stock has additional behavior beyond
the standard state edit:

- WO transitions: WOStatus from Complete back to Open
- All steps reset to Waiting (effectively a full rollback to start of
  routing — re-enters at Purchase per the standard rollback rule)
- Stock Count for the WO's Part increments by the WO's CompletedQty
- For Assemblies: if the WO was Complete via Stock Fulfillment cascade
  (descendants were cascade-skipped), the cascade reverse fires — all
  cascade-skipped descendants un-Skip and return to Open + Purchase Waiting
  in the same atomic transaction (Path D from prior decisions)
- Single AuditLog entry captures the action and its cascade scope

### Modal Permissions

- Operators: not available (Operators do not access Project View)
- Lead: view-only (cannot initiate state edits)
- Manager: full access
- Admin: full access

---

## Recovery Path — Skip-and-Fulfill (Missed Stock Fulfillment)

When a WO should have been pulled from stock but was passed through to
procurement (operator oversight in Stock Fulfillment), it can be recovered
in Project View via the Skip-and-Fulfill action.

**Workflow:**
1. Manager identifies the affected WO in Project View (still Open, not
   yet completed via execution)
2. Manager initiates "Skip-and-Fulfill" on that WO
3. Pre-action eligibility check (see Eligibility below) — if blocked,
   error message surfaces; if eligible, confirmation modal opens
4. Confirmation modal:
   - "This will mark all remaining steps Skipped and complete the WO from
     stock. Stock Count: [N] → [N - Demand]. Note: [optional]"
   - Surfaces the from-stock implication explicitly
5. On confirmation:
   - All not-yet-Complete steps transition to Skipped
   - WOStatus transitions to Complete
   - Stock decrements by WO Demand
   - For Assemblies: descendant cascade applies (descendants un-Skip and
     return to Open + Purchase Waiting per Path D from Stock Fulfillment)

### Eligibility

- Stock Count ≥ Demand at time of action (same rule as Stock Fulfillment's
  Fulfill from Stock)
- For Assembly WOs: NO descendants of the Assembly can be in Complete
  state via any path (real production, cascade-skip from prior Stock
  Fulfillment, or earlier Skip-and-Fulfill)

### Assembly with Complete Descendants — Recovery Path

If a manager attempts Skip-and-Fulfill on an Assembly that has Complete
descendants, the action is blocked. The error message lists the WO IDs of
the blocking descendants:

> "Cannot Skip-and-Fulfill [Assembly Y] from stock — [N] descendant WOs
> have been completed through production. Pulling this Assembly would
> erase the audit trail of those completions. To recover: return the
> following descendants to stock first (via Project View Return to Stock
> action), then retry the Skip-and-Fulfill on this Assembly:
> [WO ID list]"

The manager applies Return to Stock (Primitive 3) to each completed
descendant. Each Return-to-Stock decrements the Assembly's component
parts back into stock, returns each descendant WO to Open + Purchase
Waiting. Once no descendants remain Complete, Skip-and-Fulfill on the
Assembly becomes available.

This recovery is multi-step but uses existing primitives consistently. The
audit trail captures every action: original production, Return to Stock,
new Skip-and-Fulfill, descendant cascade reverse. No state is lost.

**Hard rule:** Skip-and-Fulfill is a manager recovery action available only
in Project View. It is not surfaced in any execution lens. The Stock
Fulfillment view's normal Fulfill action is for planning-phase decisions;
Skip-and-Fulfill is for after-the-fact recovery.

**Hard rule:** Skip-and-Fulfill on an Assembly is blocked if any descendant
WO in the same Project is in Complete state. The recovery path is to
Return-to-Stock the offending descendants first, then retry. The error
message must list the blocking descendant WO IDs.

---

## Batches in Project View

Batches are not rows in Project View — only WOs are rows. Each WO that is
a member of a batch carries a Batch Icon indicator in the row.

### Batch Icon Behavior

- Visible on any WO that has `batchId IS NOT NULL`
- Click navigates to the Batch Context section of the side panel
- Click also enables inline batch member expansion (see below)

### Inline Batch Member Expansion

A pattern reused from Stock Fulfillment View: clicking the batch icon
expands the row inline to show all other WOs in the same batch — directly
below the clicked row. Each member entry shows:
- WO ID, Part Number, Quantity, Project, Top-Level Reference, Parent WO

The expansion does not move the other batch members from their actual
positions in the BOM-organized row list. Each member still shows under
its own Project + Top-Level branch in the main list. The expansion is a
context-revealing peek, not a reordering operation.

Collapse returns the row to its normal display.

**Hard rule:** Inline batch expansion shows batch members for context only.
The members continue to occupy their actual positions in the row list.

### Batch Manipulation

Project View does not host batch manipulation actions (Split, Merge,
Create, Remove). These live in Batch Editor. The side panel's Batch
Context section provides an "Open in Batch Editor" link for navigation.

---

## Side Panel

Project View uses the shared side panel per Detail Panel spec. The panel's
structure is defined there and is not duplicated here.

Project View's invocation of the side panel:
- Selecting any row opens the side panel for that WO
- Side panel scrolls to its Header section by default
- Section icons in the panel jump to specific sections (Status, Routing
  detail, Dependency, Batch context, Notes, Actions)
- Actions available in the panel match the actions available inline plus
  any panel-only actions defined in the Detail Panel spec

**WO ID** is shown in the side panel Header (since it is omitted from the
row list).

---

## View-Shaping Controls

A dedicated control bar above the row list (and below the Project Key area)
holds the shape-of-view controls:

- **Routing Grid mode toggle** — Compact / Expanded
- **Anchor selector** — None (default) / pick a process step
- **Anchor post-step count** — when anchor is active, configure 1-5 post-
  anchor columns
- **Anchor-relative filters** — checkboxes for Anchor Pending, Ready for
  Anchor, Anchor Waiting, Include Completed Anchor, etc.
- **Sort selector** — BOM order (default) / Project Due Date / Priority /
  custom (where applicable). Sorting by Readiness Deficiency lives in
  Operations Lens where the question is more naturally asked
- **Show Complete rows toggle** — on / off (default off)
- **Show Unreleased rows toggle** — on (default, displayed de-emphasized)
  / off (hidden entirely)
- **Show Cancelled rows toggle** — on / off (default off). When on, Cancelled
  WOs appear in the row list with heavy visual de-emphasis (greyed/strikethrough)
  to preserve BOM tree position context while clearly signaling terminal state
- **Status filter** — Blocked only / Ready only / etc.
- **Pending Definition Changes filter** — show only rows with open Definition
  Change Flags (yellow flag indicator). Default off
- **Open Supply Order Exceptions filter** — show only rows with active
  Supply Order Line Exceptions (white flag indicator). Default off
- **Open Assembler Review Flags filter** — show only Assembly rows with open
  Assembler Review Flags. Default off. Useful for managers performing review
  sweeps before project archival or as routine quality oversight
- **Columns control** — opens a panel listing all available columns with
  show/hide toggles. User preferences persist per-user (localStorage in
  Rev 1; server-side persistence is Rev 2)
- **Search input + mode toggle** — multi-attribute search with two modes:
  - **Filter mode (default):** narrows the row list to matches; non-matches
    disappear; combines with other filters; collapses indents (treated as
    a tree-fragmenting operation)
  - **Find mode:** matches highlighted in the existing row list; non-matches
    stay visible (de-emphasized); does NOT collapse indents (the row list
    isn't being fragmented, just navigated)
  - Mode toggle persists during the session
  - UI consideration deferred to mockup: dropdown for attribute constraint
    (search by Part Number only, etc.)

This is a dense control area by design. Project View users are managers
and analysts who benefit from configurable shape; the controls are visible
because they're frequently used. UI mockup work will balance density
against accessibility — some controls may belong in a collapsible "advanced"
area or a settings panel that persists user defaults.

---

## Permissions

| Action | Operator | Lead | Manager | Admin |
|--------|----------|------|---------|-------|
| View Project View | — | ✓ | ✓ | ✓ |
| Filter via Project Key | — | ✓ | ✓ | ✓ |
| Sort, search, anchor, view shape | — | ✓ | ✓ | ✓ |
| Inline edits (Priority, sub-status, etc.) | — | — | ✓ | ✓ |
| State edits via confirmation modal | — | — | ✓ | ✓ |
| Skip-and-Fulfill recovery | — | — | ✓ | ✓ |
| Return to Stock (Primitive 3) | — | — | ✓ | ✓ |
| Open side panel for any WO | — | ✓ | ✓ | ✓ |
| Navigate to Batch Editor / Part Form / process lenses | — | ✓ | ✓ | ✓ |

Lead has read-and-navigate access. Manager and Admin have full edit
access. Operator does not access Project View.

---

## Schema Implications

This view consumes existing schema. It does not introduce new fields beyond
what is already specified in upstream specs (Project Creation, Stock
Fulfillment, state model, terminology lock).

**AuditLog action types referenced by this view's actions:**
- Standard step-state-change events (`StepStateChanged` with before/after)
- `WOStateChanged` for higher-level transitions (e.g., Complete → Open via
  Return to Stock)
- `StockAllocation` for from-stock prompts (combined WO state change +
  stock decrement, single entry)
- `ManagerSkipAndFulfill` for recovery actions
- `ReturnToStock` (with cascade scope when applicable)
- `InferredStepSkip` for steps marked Skipped by inference
- Standard inline-edit AuditLog entries (Priority change, sub-status change,
  etc.)

These are mostly already specified in upstream specs; this is a
consolidated reference for what Project View triggers.

---

## Hard Rules Introduced by This Spec

| # | Rule |
|---|------|
| PV-1 | Project View shows WOs from Active and Complete (non-Archived) Projects by default |
| PV-2 | The view is a flat row list — no Project section headers, no Top-Level Item sub-sections. Project context is carried by the Project column |
| PV-3 | Project Key (configuration area) shows all non-Archived Projects as toggleable buttons. All Projects appear identically regardless of Status |
| PV-4 | Project Key filtering hides WOs from the row list but does not affect which Projects appear in the Key |
| PV-5 | Status column shows exactly one signal at a time, by priority: Blocked > Active Process (any step in Ready or Started state) > Assembly Readiness Fraction (Assembly with all routing steps still Waiting) > State name |
| PV-5a | The Assembly Readiness Fraction applies to all Assembly types regardless of process types in the routing template. The fraction drops when the first routing step transitions Waiting → Ready (no operator action required) |
| PV-6 | Indents render only when the row list represents complete BOM trees. Project and Top-Level Reference filters preserve trees; sort changes, search Filter mode, and tree-fragmenting filters collapse indents. Search Find mode preserves indents |
| PV-7 | Anchoring alone does not collapse indents; anchor-relative filters do |
| PV-8 | Routing Grid mode (Compact / Expanded) is view-level, applied uniformly to all visible rows |
| PV-9 | Inline edits autosave with no confirmation; state-affecting edits go through the shared confirmation+note modal |
| PV-10 | The from-stock prompt fires on out-of-sequence step Complete on a not-Complete WO, OR on CompletedQty increase on a Complete WO. From-stock = yes produces a single combined AuditLog entry (state change + stock allocation) |
| PV-11 | Out-of-sequence step Complete infers prior incomplete steps as Skipped, all in one atomic transaction with per-step AuditLog entries |
| PV-12 | Return to Stock (Primitive 3) on an Assembly that was Stock-Fulfilled with cascade triggers atomic cascade reverse — descendants un-Skip and return to Open + Purchase Waiting (Path D) |
| PV-13 | Skip-and-Fulfill is a manager recovery action available only in Project View, not in execution lenses |
| PV-13a | Skip-and-Fulfill on an Assembly is blocked if any descendant WO in the same Project is in Complete state (via any path). Error message lists blocking descendant WO IDs and references the Return-to-Stock recovery path |
| PV-14 | Project View does not host batch manipulation. Batch Icon click reveals batch context (side panel + inline expansion); structural batch changes navigate to Batch Editor |
| PV-15 | Inline batch member expansion shows context only; member rows continue to occupy their actual positions in the BOM-organized row list |
| PV-16 | Project metadata edits (Name, Customer, Notes, Due Date) are NOT made in Project View. They live in Project Creation View |
| PV-17 | Project archival is NOT initiated from Project View. It lives in Project Creation View |
| PV-18 | WO ID does not appear on the row list. It is shown in the side panel Header. ScrapQty does not appear on the row list either |
| PV-19 | Search has two modes: Filter (default, narrows row list, collapses indents) and Find (highlights matches in existing list, preserves indents). When Filter matches are hidden by other filters, the view surfaces "N results hidden by filters" |
| PV-20 | Per-column visibility is user-configurable via the Columns control. Default visible set is the most commonly-used columns; less-used operationally valuable columns are available but hidden by default. Preferences persist via localStorage in Rev 1 |
| PV-21 | Material ETA column visually differentiates outstanding vs. received items. Received items display struck-through or grayed; outstanding ETAs display normally. This communicates outstanding-vs-received at a glance without an additional column |

---

## Design Notes

- Project View's organizing principle is **Project + BOM context**. This is
  what differentiates it from Operations Lens (which organizes by process and
  shop flow). A user with a project-completeness question (where are we on
  20137? what's left?) comes here. A user with a shop-flow question (what's
  next at Machine? what's blocking the floor?) goes to Operations Lens. The
  two views see overlapping data through different organizing lenses

- **A working principle for choosing between Project View and Operations
  Lens:** if the question puts the *Project* as the organizing axis ("which
  projects are at risk?", "what's blocking project X?", "what materials
  are blocking which projects?"), Project View is the natural home. If the
  question puts the *process* as the organizing axis ("what's queued at
  blackening?", "which assemblies should I load next?", "what can be
  consolidated for one setup?"), Operations Lens is the natural home.
  Cross-cutting questions (like "which projects have blackening waiting
  on material X?") can be answered from either view because both surface
  the relevant attributes — Project View answers it as a project-scoped
  list; Operations Lens answers it as a process-scoped list. Don't try
  to make Project View answer every operations-side question. The two
  views complement each other deliberately

- The flat row list with Project column is deliberately simpler than
  hierarchical sections. Sections add render overhead, complicate sorts,
  break with anchor view, and don't add information that the Project column
  doesn't already carry. The flat list scales better and remains readable
  with many Projects in flight

- The Project Key as a dual-purpose tool (visual key + filter control) is
  efficient — it answers "what's in flight" and provides the affordance to
  focus the view in one component

- The Status column simplification (single signal, hover for detail) keeps
  the row scannable. Most rows show a single word or a process name.
  Managers scanning for problems can spot Blocked treatments immediately;
  managers scanning for Assembly readiness can spot fractions in the right
  cells. Hover gives the depth when needed

- The confirmation+note modal pattern unifies all state-affecting edits
  under one UX. Managers don't need to learn separate workflows for
  rollback, skip, qty correction, return-to-stock, etc. — they all use the
  same modal with action-specific summary and side-effect display

- Drift correction is the primary management-action use case for this view.
  Operations Lens shows what's happening; Project View lets management
  intervene when reality has diverged from the plan

- The dense column set is acceptable because per-column visibility is user-
  configurable. Power users surface what they need; default views stay
  scannable. Horizontal scroll friction is mitigated by hiding less-used
  columns by default

- The Find / Filter mode toggle on search recognizes that "I want to focus
  on these rows" and "I want to locate this in the existing list" are
  different operations with different UX needs. Both are valuable; supporting
  both via a mode toggle is a small UI cost for a meaningful UX gain

- Performance consideration: a large multi-Project view could include
  thousands of WO rows. Implementation should virtualize the row list and
  lazy-render where appropriate. The spec specifies behavior; the
  implementation handles render performance

---

## Open Items for Reconciliation Pass

The following items in this spec touch other specs and should be reviewed
during the post-Stage-7 reconciliation pass:

**View visibility:**
- **Operations Lens spec:** Confirm visibility filter (`WOStatus != Unreleased`)
  and explicit Project View vs. Operations Lens distinction in design notes
- **Execution lens specs:** Confirm step prerequisite gating remains the
  primary gate; Project View's broader visibility (showing Unreleased rows)
  is unique to Project View

**Side panel:**
- **Detail Panel spec / Side Panel Addendum:** Confirm shared side panel
  behavior matches what Project View needs. Add Project-View-specific
  behaviors if any (e.g., Skip-and-Fulfill action lives in panel actions)

**Anchor + Filter system:**
- **Anchor Filter spec:** Confirm the anchor-relative filters integrate
  with the indent rule as specified (anchor-relative filters fragment
  trees, collapse indents)

**Batch context:**
- **Batch Editor spec:** Confirm "Open in Batch Editor" link from side
  panel batch context routes correctly
- **Inline batch member expansion:** confirm consistent behavior with
  Stock Fulfillment View's analogous pattern

**Skip-and-Fulfill cascade:**
- For an Assembly Skip-and-Fulfill, the descendant cascade reverse applies
  (descendants un-Skip and return to Open + Purchase Waiting). This is
  consistent with the Stock Fulfillment cascade behavior. The eligibility
  constraint (no Complete descendants allowed) prevents the audit-erasure
  problem that the cascade would otherwise create

**Process lens specs:**
- Confirm that inline edits available in Project View match what's
  available inline in each process lens. Project View should be a
  superset, not different
- **Operations Lens spec:** Add Readiness Deficiency as a sort option
  (derived value: 0 means all components on hand, higher numbers indicate
  more components remaining — e.g., 3 for a 13/16 Assembly). This is
  where the "which assemblies are closest to ready" question naturally
  belongs

**Terminology lock and state model:**
- Confirm new action types (`StockAllocation`, `ManagerSkipAndFulfill`,
  `ReturnToStock`, `InferredStepSkip`) are added to canonical lists in
  Stage 6

**UI consideration deferred to mockup stage:**
- Column display order
- Search-with-attribute-constraint dropdown
- Specific visual treatments (de-emphasis level for Unreleased, exact
  colors for Blocked, Assembly readiness fraction display format, etc.)
- Whether row left-edge color (Project color or process color) adds value
- Routing pill visual treatment specifics (filled/outlined/faint for state)

**Rev 2 backlog:**
- Project View support for Archived Projects (read-only filter)
- Project View bookmarking (saved filter/sort/anchor configurations)
- Permission granularity (e.g., separate "view edits" from "make edits")
- **Process column groups** — show/hide a set of process-relevant columns
  together. Examples: Purchasing group (Material, Vendor, Material ETA),
  Machining group (Material, Machine Assignment, Operator Assignment),
  Outsource group (Vendor, Material ETA). Surfacing these in Project View
  reduces the need to navigate to specific process lenses to answer
  process-context questions, keeping managers in their natural view
- **Server-side persistence of column visibility preferences** — Rev 1
  uses localStorage so preferences travel with the browser. Rev 2 should
  persist to the user record so preferences follow the user across devices
- **Machine Assignment and Operator Assignment columns** — useful for
  machine and operator-driven queries, deferred because their value is
  realized primarily as part of process column groups (see above) which
  are themselves Rev 2
