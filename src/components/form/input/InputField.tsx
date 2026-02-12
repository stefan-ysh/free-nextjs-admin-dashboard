import React, { FC } from "react";

interface InputProps {
  type?: "text" | "number" | "email" | "password" | "date" | "time" | string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  min?: string;
  max?: string;
  step?: number;
  disabled?: boolean;
  success?: boolean;
  error?: boolean;
  hint?: string; // Optional hint text
}

const Input: FC<InputProps> = ({
  type = "text",
  id,
  name,
  placeholder,
  value,
  defaultValue,
  onChange,
  className = "",
  min,
  max,
  step,
  disabled = false,
  success = false,
  error = false,
  hint,
}) => {
  // Determine input styles based on state (disabled, success, error)
  let inputClasses = `h-11 w-full rounded-lg border appearance-none border-input bg-card px-4 py-2.5 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring ${className}`;

  // Add styles for the different states
  if (disabled) {
    inputClasses += ` cursor-not-allowed bg-muted text-muted-foreground opacity-70`;
  } else if (error) {
    inputClasses += ` border-destructive text-destructive focus:ring-destructive/20`;
  } else if (success) {
    inputClasses += ` border-chart-5 text-chart-5 focus:ring-chart-5/20`;
  } else {
    inputClasses += ` focus:border-ring`;
  }

  return (
    <div className="relative">
      <input
        type={type}
        id={id}
        name={name}
        placeholder={placeholder}
  value={value}
  defaultValue={value === undefined ? defaultValue : undefined}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={inputClasses}
      />

      {/* Optional Hint Text */}
      {hint && (
        <p
          className={`mt-1.5 text-xs ${
            error
              ? "text-error-500"
              : success
              ? "text-success-500"
              : "text-muted-foreground"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
};

export default Input;
