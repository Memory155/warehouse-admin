"use client";

import { Key, useState } from "react";
import { ChevronDown } from "lucide-react";
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
  triggerClassName?: string;
  valueClassName?: string;
};

export default function AppSelect({
  value,
  onChange,
  options,
  placeholder = "请选择",
  ariaLabel,
  disabled = false,
  triggerClassName = "",
  valueClassName = "",
}: AppSelectProps) {
  const [open, setOpen] = useState(false);

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
      onOpenChange={setOpen}
      isDisabled={disabled}
      aria-label={ariaLabel ?? placeholder}
    >
      <Select.Trigger
        className={`w-full justify-between rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 ${triggerClassName}`.trim()}
      >
        <Select.Value className={valueClassName}>
          {() =>
            selectedLabel ? (
              selectedLabel
            ) : (
              <span className="text-zinc-400">{placeholder}</span>
            )
          }
        </Select.Value>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
            open ? "rotate-180" : "rotate-0"
          }`}
        />
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
