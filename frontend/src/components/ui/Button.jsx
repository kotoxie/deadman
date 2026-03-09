import { clsx } from 'clsx';

const variants = {
  primary: 'bg-brand hover:bg-brand-dark text-white',
  secondary: 'bg-surface-lighter hover:bg-gray-500 text-white',
  danger: 'bg-red-700 hover:bg-red-800 text-white',
  ghost: 'bg-transparent hover:bg-surface-lighter text-gray-300',
  outline: 'border border-border hover:bg-surface-lighter text-gray-300',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({ variant = 'primary', size = 'md', className, children, ...props }) {
  return (
    <button
      className={clsx(
        'rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
