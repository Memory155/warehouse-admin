"use client";

import { Key } from "react";
import { ListBox, ListBoxItem, Select } from "@heroui/react";

export type SelectOption = {
  value: string;
  label: string;
};

type AppSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

export default function AppSelect({
  value,
  onChange,
  options,
  placeholder = "请选择",
  ariaLabel,
  disabled = false,
}: AppSelectProps) {
  function handleSelectionChange(key: Key | null) {
    if (key === null) {
      onChange("");
      return;
    }
    onChange(String(key));
  }

  const selectedKey = value || null;
  const selectedLabel = options.find((item) => item.value === value)?.label;

  return (
    <Select
      selectedKey={selectedKey}
      onSelectionChange={handleSelectionChange}
      isDisabled={disabled}
      aria-label={ariaLabel ?? placeholder}
    >
      <Select.Trigger className="w-full justify-between rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800">
        <Select.Value>
          {() =>
            selectedLabel ? (
              selectedLabel
            ) : (
              <span className="text-zinc-400">{placeholder}</span>
            )
          }
        </Select.Value>
      </Select.Trigger>
      <Select.Popover placement="bottom start" offset={8} className="z-50">
        <ListBox className="rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
          {options.map((item) => (
            <ListBoxItem
              key={item.value}
              id={item.value}
              textValue={item.label}
              className="rounded-md px-3 py-2 text-sm text-zinc-700 data-[hovered=true]:bg-zinc-100"
            >
              {item.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
