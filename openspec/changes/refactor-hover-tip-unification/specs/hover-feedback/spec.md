## ADDED Requirements

### Requirement: Shared Hover Tips SHALL Use A Unified Tooltip Component

The system SHALL provide a shared tooltip component for non-interactive hover tips so that common hover guidance follows consistent theme, delay, z-index, and accessibility behavior.

#### Scenario: Action button shows shared hover tip

- **WHEN** a component needs to display a short hover tip for a button, icon, or status indicator
- **THEN** it SHALL use the shared hover tip component
- **AND** SHALL NOT directly depend on a local ad-hoc tooltip implementation

#### Scenario: Shared tooltip removes duplicate native hover metadata

- **WHEN** the wrapped trigger already carries native `title` or `data-tooltip`
- **THEN** the shared hover tip SHALL suppress those duplicate hover props
- **AND** SHALL keep the shared tooltip as the only visible hover tip

### Requirement: Interactive Hover Content SHALL Use A Shared Hover Card

The system SHALL provide a shared hover card component for hover content that needs pointer continuity or richer content than a short tip.

#### Scenario: Hover content remains visible across trigger and popup

- **WHEN** the pointer moves from the trigger into the hover popup
- **THEN** the popup SHALL remain open long enough to preserve interaction continuity

#### Scenario: Hover card closes after leaving the interaction region

- **WHEN** the pointer leaves both trigger and popup
- **THEN** the hover card SHALL close after a short unified delay

### Requirement: Component Layer SHALL Block Direct Tooltip Imports

The system SHALL prevent new component code from bypassing the shared hover layer with direct tooltip imports.

#### Scenario: Developer imports Tooltip directly in component code

- **WHEN** component-layer source code imports `Tooltip` from `tdesign-react`
- **THEN** the repository checks SHALL fail
- **AND** the change SHALL be redirected to the shared hover components
