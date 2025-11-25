"use client";
import React from "react";
import ComponentCard from "../../common/ComponentCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function ToggleSwitch() {
  const handleSwitchChange = (checked: boolean) => {
    console.log("Switch is now:", checked ? "ON" : "OFF");
  };
  return (
    <ComponentCard title="Toggle switch input">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch id="switch-1" defaultChecked={true} onCheckedChange={handleSwitchChange} />
            <Label htmlFor="switch-1">Default</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="switch-2" defaultChecked={true} onCheckedChange={handleSwitchChange} />
            <Label htmlFor="switch-2">Checked</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="switch-3" disabled={true} />
            <Label htmlFor="switch-3">Disabled</Label>
          </div>
        </div>
      </div>
    </ComponentCard>
  );
}
