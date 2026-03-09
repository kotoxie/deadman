import { clsx } from 'clsx';
import { forwardRef } from 'react';

const Input = forwardRef(function Input({ label, error, className, ...props }, ref) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-gray-300">{label}</label>}
      <input
        ref={ref}
        className={clsx(
          'w-full rounded-lg border bg-surface-light px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors',
          error ? 'border-red-500' : 'border-border',
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
});

export default Input;
