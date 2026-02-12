import React from "react";

interface TextareaProps {
  placeholder?: string; // Placeholder text
  rows?: number; // Number of rows
  value?: string; // Current value
  onChange?: (value: string) => void; // Change handler
  className?: string; // Additional CSS classes
  disabled?: boolean; // Disabled state
  error?: boolean; // Error state
  hint?: string; // Hint text to display
}

const TextArea: React.FC<TextareaProps> = ({
  placeholder = "Enter your message", // Default placeholder
  rows = 3, // Default number of rows
  value = "", // Default value
  onChange, // Callback for changes
  className = "", // Additional custom styles
  disabled = false, // Disabled state
  error = false, // Error state
  hint = "", // Default hint text
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  let textareaClasses = `w-full rounded-lg border border-input bg-card px-4 py-2.5 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring ${className}`;

  if (disabled) {
    textareaClasses += ` cursor-not-allowed bg-muted text-muted-foreground opacity-70`;
  } else if (error) {
    textareaClasses += ` border-destructive text-destructive focus:ring-destructive/20`;
  } else {
    textareaClasses += ` focus:border-ring`;
  }

  return (
    <div className="relative">
      <textarea
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={textareaClasses}
      />
      {hint && (
        <p
          className={`mt-2 text-sm ${
            error ? "text-error-500" : "text-muted-foreground"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
};

export default TextArea;
