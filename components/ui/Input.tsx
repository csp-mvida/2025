import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, error, helperText, className = '', ...props }, ref) => {
  return (
    <div className="w-full">
      <label className="block text-sm md:text-base font-medium text-slate-700 mb-1.5">
        {label} {props.required && <span className="text-accent">*</span>}
      </label>
      <input
        ref={ref}
        className={`
          w-full px-4 py-2.5 md:py-3 rounded-lg bg-white border shadow-sm
          text-slate-900 placeholder-slate-400 transition-colors
          text-base md:text-lg
          focus:outline-none focus:ring-2 focus:ring-primary/50
          ${error ? 'border-danger focus:border-danger focus:ring-danger/30' : 'border-slate-300 focus:border-primary'}
          ${props.disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-sm md:text-base text-danger">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs md:text-sm text-slate-500">{helperText}</p>}
    </div>
  );
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label: string, error?: string }>(({ label, error, children, ...props }, ref) => {
  return (
    <div className="w-full">
      <label className="block text-sm md:text-base font-medium text-slate-700 mb-1.5">
        {label} {props.required && <span className="text-accent">*</span>}
      </label>
      <div className="relative">
        <select
          ref={ref}
          className={`
            w-full px-4 py-2.5 md:py-3 rounded-lg bg-white border shadow-sm appearance-none
            text-slate-900 transition-colors
            text-base md:text-lg
            focus:outline-none focus:ring-2 focus:ring-primary/50
            ${error ? 'border-danger focus:border-danger' : 'border-slate-300 focus:border-primary'}
            ${props.disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}
          `}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
          <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
      {error && <p className="mt-1 text-sm md:text-base text-danger">{error}</p>}
    </div>
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string, error?: string }>(({ label, error, className = '', ...props }, ref) => {
  return (
    <div className="w-full">
      <label className="block text-sm md:text-base font-medium text-slate-700 mb-1.5">
        {label} {props.required && <span className="text-accent">*</span>}
      </label>
      <textarea
        ref={ref}
        className={`
          w-full px-4 py-2.5 md:py-3 rounded-lg bg-white border shadow-sm
          text-slate-900 placeholder-slate-400 transition-colors
          text-base md:text-lg
          focus:outline-none focus:ring-2 focus:ring-primary/50
          ${error ? 'border-danger focus:border-danger' : 'border-slate-300 focus:border-primary'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-sm md:text-base text-danger">{error}</p>}
    </div>
  );
});