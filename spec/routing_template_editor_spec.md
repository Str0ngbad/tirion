# Tirion — Routing Template Editor Spec

## Purpose

The Routing Template Editor is a minimal configuration view for creating and managing
named routing presets. Templates are the source of truth for how parts are produced.
Parts reference templates; Work Orders are generated from them as snapshots at
Project compilation time.

This is a low-traffic, high-consequence view. Users visit it to define a new template
or make a deliberate change to an existing one. It is not a day-to-day operational view.

---

## Template Library

The main view is a simple list of all routing templates.

Each row shows:
- Template Name
- Description
- Step count
- Step sequence (compact process type pills — one per step, ProcessType color)
- Parts using this template (count)
- Active indicator (read-only green dot for active, gray dot for inactive)

Default sort: Template Name alphabetical.

**Library filter — three-state API, two-state UI:**

The API accepts a three-state `active` filter parameter:
- `active=true` (default) — active templates only
- `active=false` — inactive templates only
- `active=all` — both active and inactive

This matches the convention established by the Vendor, MaterialSpec, User,
and Part backends.

The Rev 1 UI exposes a two-state control: a "Show Inactive" toggle that
switches between `active=true` (off, default) and `active=all` (on). The
`active=false` (inactive-only) API state is available for future UI needs
but is not surfaced in the Rev 1 mockup.

**Rationale:** Shop-use experience suggests the inactive-only query is
vanishingly rare. The API retains the state for consistency across
configuration entities and to avoid backend churn if the UI later needs it.

**Retire and Reactivate actions** are accessed via a three-dot (⋯) menu on
each row. The menu surfaces Retire on active template rows and Reactivate on
inactive template rows. The Active indicator is never directly clickable.

**Design note:** Template names should be descriptive enough to be self-explanatory
in a dropdown. Examples: "Machined Part", "Machined + Blackened Part",
"Welded Assembly", "Painted Bracket", "Purchased Finished Component",
"3D Printed Part." These are the options a user sees when assigning routing
to a part — the name must communicate the sequence without requiring the
user to open the form.

---

## Creating a New Template

Triggered by "Add Template" button. Opens the Template Form in create mode.

**Required fields:**
- Template Name (must be unique)

**Optional:**
- Description

**Steps section:**
- Add steps via ProcessType dropdown (searchable)
- Steps display in order with step number and process type pill
- Reorder via drag or up/down controls
- Remove step via delete control

**Validation:**
- Template Name must be unique — inline error if duplicate detected before save
- No validation on process type combinations at creation time — the constraint
  (no Purchase/Receive steps on Assembly parts) is enforced at part assignment
  time, not template creation time
- No hard step count limit. The color-coding visual system supports approximately
  8 ProcessTypes effectively — beyond that, color differentiation becomes
  unreliable. This is a design constraint, not a system limit.

On save: template created, appears in library, available for part assignment.

---

## Editing an Existing Template

Clicking a template row opens the Template Form in edit mode.

**Before the form opens — Edit-Time Dialog (Definition Change Flag System):**

The edit-time dialog fires when `partsReferencingCount > 0` OR `openWoCount > 0`.
A newly created template with no Parts assigned and no Work Orders generated yet
is a valid state — editing such a template skips the dialog and opens the form
directly. This is the no-impact fast path.

When the dialog condition is met, an acknowledgment dialog appears before opening
the form. This is the Routing Template Editor surface of the Definition Change
Flag system (see `definition_change_flag_spec.md`).

The dialog shows:

**Header:** "This change has downstream impact"

**Section 1 — Definition References:**
- "[Template Name] is assigned to [N] Parts"
- Expandable list of Parts using this template

**Section 2 — WIP Impact** (shown when open WOs reference this template):
- "[N] open Work Orders will be flagged for review"
- Expandable list with WO ID, Project + Top-Level Reference, Part Number,
  current step, status
- Batched WOs indicate batch context

**Section 3 — Stock Impact** (shown when affected Parts have stock > 0):
- Aggregate stock counts across affected Parts
- Reminder: existing stock may need review for conformity

**Buttons:** Confirm Change / Cancel

The dialog has no "apply to WIP" option. The user's only choices are confirm
(saves the change, creates flags for affected open WOs) or cancel (discards
the change entirely).

If confirmed: form opens, all fields editable.

### What Can Be Edited

- Template Name
- Description
- Steps (add, remove, reorder)

### What Cannot Be Edited

Nothing is technically locked — the dialog communicates the weight of the
change before the user proceeds. This friction is intentional.

### On Save

Atomic transaction:
1. Template updated
2. AuditLog entry written for the underlying change
3. One flag created per open Work Order that references this template
4. For batched WOs: batch flag created and member flags reference it
5. All Parts referencing this template now show the updated step sequence in
   their Part Form view
6. Future Work Orders generated from these Parts use the new sequence
7. Existing open Work Orders are NOT modified (Principle 10) — they retain
   their snapshot routing until manager resolves their flags
8. Toast: "Template saved. [N] WOs flagged for review."

**API contract — save response shape:**

The save endpoint's success response includes a `flaggedWoCount` number field
representing how many open Work Orders received a Definition Change Flag as a
result of the save.

In Rev 1 Phase 1C, this field is always `0` because the WorkOrder layer and
the Definition Change Flag system do not yet exist. The field is present in the
response shape from Phase 1C so the API contract is stable; when WorkOrder
lands in a later phase, the field will populate from the actual flag-creation
count.

The frontend may suppress the "[N] WOs flagged for review" portion of the toast
when `flaggedWoCount` is 0 and show a generic "Template saved." message instead.
UI behavior on the zero case is a frontend decision; the API contract is fixed.

### Hard Rules

- **RTE-DCF-1:** No Routing Template change silently affects open Work Orders
  generated from this template. The user must always acknowledge the impact
  before saving.
- **RTE-DCF-2:** Template changes do not modify WorkOrderStep records on existing
  open WOs. Step state and structure are preserved per Principle 10. Only flags
  are created.
- **RTE-DCF-3:** Accept Change resolution on a Routing Template flag is the only
  mechanism by which an existing WO's steps can be regenerated from the new
  template. See `definition_change_flag_spec.md` for the regeneration workflow.

---

## Retiring a Template (Soft Delete)

Toggling `isActive = false` on a template retires it. Retirement is a
high-consequence action and requires the same confirmation screen as editing.

**Before retiring — confirmation screen showing:**
- Template name
- Number of parts currently referencing this template
- Number of open Work Orders on parts that use this template
- Statement: "Retiring this template will prevent new Work Orders from being
  generated for parts that reference it. Existing open Work Orders are not
  affected. Parts referencing this template must be assigned a new active
  template before new Work Orders can be compiled."
- Confirm / Cancel

**After retiring:**
- Retired templates are hidden from the part assignment dropdown
- Parts currently referencing a retired template retain the reference —
  their existing open Work Orders continue unaffected (Principle 10)
- New WO generation (Project compilation) for parts referencing a retired
  template is blocked at compilation time — see Project Compilation Gate below
- Retired templates remain visible in the template library under the
  Inactive filter and can be reactivated

### Reactivation

Reactivation is initiated from the three-dot (⋯) menu on an inactive template
row in the library.

Reactivation is immediate — no confirmation dialog. This matches the Vendor
reactivation pattern established in Phase 1A. Reactivation does not introduce
downstream risk (no Parts are being newly affected, no open WOs are modified),
so the friction of a confirmation dialog is not warranted.

The reactivation action writes a `TemplateReactivated` AuditAction entry on the
template record.

After reactivation the template is immediately available for assignment to Parts
and for new Work Order generation at Project compilation.

**Note on asymmetry:** Retirement requires confirmation because it has downstream
impact — Parts referencing the template are blocked from future WO compilation.
Reactivation does not introduce that risk and proceeds immediately.

---

## Project Compilation Gate

Before generating Work Orders from a Project, the system validates every Part
in the BOM tree. Compilation is blocked entirely if any Part fails validation.
No partial WO trees are created.

**Validation checks at compilation:**
- Every Part has an assigned Routing Template
- Every assigned Routing Template is active (not retired)

**Error behavior:** The compilation attempt is cancelled. The user sees a
pre-compilation error screen listing every Part that failed validation and
the reason (no template assigned / template retired). No Work Orders are
created until all failures are resolved.

**Hard rule:** Project compilation is all-or-nothing. A partial WO tree is
never created under any circumstances.

Full workflow spec for Project Creation and WO generation is a separate view
spec to be written in Stage 5. See OQ-015.

---

## Part Assignment (in Part Form)

Templates are assigned to parts in the Part Form's Routing section, not here.
The Part Form shows:
- Currently assigned template name and step pills (read-only), or
  "No template assigned" if none
- "Change Template" control — searchable dropdown of active templates only
- "View / Edit in Routing Template Editor" link — navigates to this view
  with the current template pre-selected

When a template is assigned to an Assembly part, the system checks whether
the template contains Purchase or Receive steps. If it does, assignment is
blocked with an inline error: "This template includes purchasing steps and
cannot be assigned to an Assembly part."

Changing a Part's assigned template when open WOs exist triggers the
Principle 10 confirmation screen. See Parts Master spec.

---

## Design Notes

- This view deliberately feels deliberate and slightly friction-ful. The
  confirmation screen on edit and retirement is not an obstacle — it is the
  feature. Template changes have broad consequences and users should feel
  that weight.
- The step pills in the template library give users a visual scan of the
  sequence without opening the form. This is the primary navigation aid
  when choosing between similar templates.
- The color-coding visual system for routing step pills supports approximately
  8 ProcessTypes. Adding new ProcessTypes beyond that requires a design
  decision about how to maintain visual clarity.
