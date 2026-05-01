## ADDED Requirements

### Requirement: 图片元素支持 3D 视觉旋转
The system SHALL allow ordinary canvas image elements to persist a 3D visual transform without changing their rectangular geometry.

#### Scenario: Persist image 3D transform
- **GIVEN** the user applies a 3D rotation to an ordinary image element
- **WHEN** the board data is saved and restored
- **THEN** the image SHALL display with the same `rotateX`, `rotateY`, and `perspective` values
- **AND** the image points and resize geometry SHALL remain unchanged

#### Scenario: Reset image 3D transform
- **GIVEN** an ordinary image element has a 3D transform
- **WHEN** the user resets the 3D rotation
- **THEN** the system SHALL remove the `transform3d` field when both rotation axes are zero

### Requirement: 图片选区提供 popup-toolbar 3D 调节面板
The system SHALL show a 3D adjustment control in the popup toolbar for a single selected ordinary image and update the image transform through panel controls.

#### Scenario: Adjust 3D transform from popup toolbar
- **GIVEN** a single ordinary image is selected
- **WHEN** the user opens the 3D adjustment panel from the popup toolbar
- **THEN** the panel SHALL expose controls for `rotateX`, `rotateY`, and `perspective`
- **AND** changing the controls SHALL preview the image transform on the canvas
- **AND** each axis SHALL be clamped to `-180..180` degrees
- **AND** the image SHALL remain visible after crossing the edge-on midpoint
- **AND** the user SHALL be able to confirm or cancel the adjustment

#### Scenario: Hide control for unsupported selections
- **GIVEN** the selection is empty, contains multiple elements, or targets a video/audio/PPT placeholder image
- **WHEN** the popup toolbar is rendered
- **THEN** the 3D adjustment control SHALL NOT be shown

### Requirement: 3D rotation panel interactions are lightweight and undoable
The system SHALL keep 3D panel interactions responsive while committing each confirmed adjustment as a single undoable change.

#### Scenario: Confirm one history entry
- **GIVEN** the user changes 3D panel controls multiple times
- **WHEN** the user confirms the panel
- **THEN** intermediate updates SHALL NOT create separate history entries
- **AND** undo SHALL restore the image transform to the value before the panel opened

#### Scenario: Cancel panel restores transform
- **GIVEN** the user changes 3D panel controls
- **WHEN** the user cancels or dismisses the panel
- **THEN** the image transform SHALL return to the value before the panel opened

### Requirement: AI reference images include 3D visual transforms
The system SHALL pass rendered 3D image transforms to AI workflows instead of the original untransformed image URL.

#### Scenario: Use transformed image as AI reference
- **GIVEN** a selected ordinary image has a `transform3d` value
- **WHEN** the selection is used as an AI image, video, or agent reference
- **THEN** the reference image SHALL be generated from the rendered canvas appearance
- **AND** the model SHALL receive the 3D rotated visual result rather than the source image URL
