import { useEffect, useRef, useState } from "react";

import { colorPresets } from "../lib/folder-presets";
import "./PickerControls.css";

export type ColorSelectFieldProps = {
  label: string;
  selectedColor: string;
  onSelect: (value: string) => void;
  emptyLabel: string;
  compact?: boolean;
};

function getColorPreset(color: string | null | undefined) {
  if (!color) {
    return null;
  }

  const normalizedColor = color.toLowerCase();
  return colorPresets.find((preset) => preset.value.toLowerCase() === normalizedColor) ?? null;
}

export function renderColorSwatch(color: string, className = "color-swatch") {
  return <span className={className} style={{ backgroundColor: color }} aria-hidden="true" />;
}

export function ColorSelectField({
  label,
  selectedColor,
  onSelect,
  emptyLabel,
  compact = false
}: ColorSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fieldsetRef = useRef<HTMLFieldSetElement | null>(null);
  const selectedPreset = getColorPreset(selectedColor);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!fieldsetRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    globalThis.document.addEventListener("mousedown", handlePointerDown);
    globalThis.document.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.document.removeEventListener("mousedown", handlePointerDown);
      globalThis.document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleColorSelect(nextColor: string) {
    onSelect(nextColor);
    setIsOpen(false);
  }

  return (
    <fieldset
      ref={fieldsetRef}
      className={`picker-fieldset color-select-fieldset${
        compact ? " color-select-fieldset-compact" : ""
      }`}
    >
      <legend>{label}</legend>
      <div className={`color-select${compact ? " color-select-compact" : ""}`}>
        <button
          type="button"
          className={`color-select-trigger${isOpen ? " color-select-trigger-open" : ""}`}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((currentState) => !currentState)}
        >
          <span className="color-select-trigger-value">
            {selectedPreset ? (
              renderColorSwatch(selectedPreset.value, "picker-color-swatch")
            ) : (
              <span className="color-select-empty-swatch" aria-hidden="true" />
            )}
            <span>{selectedPreset?.label ?? emptyLabel}</span>
          </span>
          <span className="color-select-trigger-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
        {isOpen ? (
          <div role="dialog" aria-label={`${label} 선택`} className="color-select-popover">
            <div className="color-select-options">
              <button
                type="button"
                className={`color-select-option${selectedPreset ? "" : " color-select-option-active"}`}
                aria-label={`${label} ${emptyLabel} 선택`}
                aria-pressed={!selectedPreset}
                onClick={() => handleColorSelect("")}
              >
                <span className="color-select-option-copy">
                  <span className="color-select-empty-swatch" aria-hidden="true" />
                  <span>{emptyLabel}</span>
                </span>
                {!selectedPreset ? (
                  <span className="choice-selection-mark" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
              {colorPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`color-select-option${
                    selectedPreset?.value === preset.value ? " color-select-option-active" : ""
                  }`}
                  aria-label={`${label} ${preset.label} 선택`}
                  aria-pressed={selectedPreset?.value === preset.value}
                  onClick={() => handleColorSelect(preset.value)}
                >
                  <span className="color-select-option-copy">
                    {renderColorSwatch(preset.value, "picker-color-swatch")}
                    <span>{preset.label}</span>
                  </span>
                  {selectedPreset?.value === preset.value ? (
                    <span className="choice-selection-mark" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}
