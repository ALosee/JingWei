/**
 * Properties for the ManagementListToolbar component.
 */
export interface ManagementListToolbarProps {
  /** List title shown in the collapsed header. */
  title: string
  /** Secondary summary line under the title. */
  summary: string
  /** Search keyword. */
  modelValue: string
  /** Accessible name for the search control. */
  searchLabel: string
  /** Placeholder for the search field. */
  searchPlaceholder: string
  /** Accessible name for the close-search control. */
  closeSearchLabel?: string
  /** Accessible name for the create control. */
  createLabel?: string
  /** Whether the create entry is available. */
  canCreate?: boolean
  /** Whether list actions should be disabled. */
  busy?: boolean
}

/**
 * Events for the ManagementListToolbar component.
 */
export interface ManagementListToolbarEmits {
  'update:modelValue': [value: string]
  create: []
}

/**
 * Slots for the ManagementListToolbar component.
 */
export interface ManagementListToolbarSlots {
  /** Extra icon actions before the create entry. */
  tools: undefined
}

/**
 * Properties for the ManagementWorkspace component.
 */
export interface ManagementWorkspaceProps {
  /** Page title exposed to assistive technology only. */
  title: string
  /** Whether the detail pane is open on narrow screens. */
  mobileDetailOpen?: boolean
  /** Label for the mobile back-to-list control. */
  backLabel?: string
  /** Accessible name for the list/detail resize handle. */
  resizeHandleLabel?: string
  /** Accessible name for the detail pane. */
  detailLabel?: string
}

/**
 * Events for the ManagementWorkspace component.
 */
export interface ManagementWorkspaceEmits {
  back: []
}

/**
 * Slots for the ManagementWorkspace component.
 */
export interface ManagementWorkspaceSlots {
  /** Full-width notice above the split panes. */
  notice: undefined
  /** List pane content. */
  list: undefined
  /** Detail pane content. */
  detail: undefined
}
