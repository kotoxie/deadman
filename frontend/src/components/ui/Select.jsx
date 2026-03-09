import { clsx } from 'clsx';
import { forwardRef } from 'react';

const Select = forwardRef(function Select({ label, error, options, className, ...props }, ref) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-gray-300">{label}</label>}
      <select
        ref={ref}
        className={clsx(
          'w-full rounded-lg border bg-surface-light px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors',
          error ? 'border-red-500' : 'border-border',
          className
        )}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
});

export default Select;
