# What's new

## Client-requested workflow updates

- Equipment Position ID / Tag Number is unique across manual entry and SQL storage; duplicates are rejected.
- Maintenance records can now be imported from and exported to Excel from the Maintenance page.
- Reports now include a dynamic written executive summary and downloadable PDF with KPIs, breakdowns, and equipment inventory.
- Add Equipment can prefill fields from an existing equipment record while leaving the new Position ID blank.

## 1. Visualization tab (Power BI / Tableau-style drill-down)
New page: **Sidebar → Visualization** (`/visualization`)

- Pick any field to group/break the equipment data by (Status, Package, Vendor,
  Location, Equipment Type, Spec/Drawing Status, plus any admin-added custom
  dropdown fields).
- Switch between **Bar** and **Pie** chart views.
- **Click any bar or pie slice** → the table below instantly filters to just
  the matching equipment records (with a "Clear drill-down" button and
  breadcrumb showing what you're looking at).
- **Export This Selection** exports only the drilled-down records to Excel.
- The existing Dashboard charts (Equipment by Status / Status Distribution)
  are now also clickable and jump straight into Visualization with that
  status pre-selected.

## 2. Export to Excel
- The existing full export still works (Reports page, Import/Export page).
- `equipmentAPI.export(filters)` now accepts filters, so:
  - The Equipment List page has a new **Export to Excel** button that
    respects your current search/status/package filters.
  - The Visualization page can export just the currently drilled-down slice.
  - Any admin-added custom fields are automatically included as extra
    columns in every export, labeled with their field name.

## 3. Admin-controlled dashboard schema (Field Manager)
New page: **Sidebar → Admin → Field Manager** (`/admin/fields`, Admin only)

- **Mandatory field control:** toggle any field (core or custom) between
  Required / Optional. The Add/Edit Equipment form and the backend both
  enforce this immediately. Position ID is locked as the key field and can't
  be made optional.
- **Add custom field:** admins can add a new field (Text / Number / Date /
  Dropdown) with an optional "mandatory" flag and (for dropdowns)
  comma-separated options.
  - In a real SQL Server deployment this runs `ALTER TABLE Equipment ADD
    [field_key] NVARCHAR(MAX)` — the database table is physically modified.
  - In this sandbox (no SQL Server connected, so the app's existing
    dev-fallback in-memory store is active) the field is registered and
    every existing equipment record is backfilled with the column.
  - The new field appears automatically on the equipment form, in exports,
    and as a grouping option in Visualization (if it's a dropdown field).
- **Remove custom field:** only admin-added fields can be deleted (core
  fields are protected); this drops the column (`ALTER TABLE ... DROP
  COLUMN`) in SQL mode.

### Notes / known limitations
- This sandbox has no live SQL Server, so testing happened against the
  app's existing development fallback store — the same fallback the app
  already used for equipment/users. The SQL code paths were written to
  mirror it (dynamic `ALTER TABLE`, a new `FieldConfig` table seeded by
  `runMigrations.js`) but haven't been run against a real SQL Server
  instance.
- The Equipment **list** endpoint's SQL query (not the dev fallback) lists
  explicit columns, so custom fields won't show as extra list columns when
  running against real SQL Server (they do show on the Equipment Detail
  page, the Edit form, and in Excel exports either way). Extending the list
  view's SQL query to include dynamic columns would be a reasonable
  follow-up if you move to a real SQL Server deployment.
