import { clsx } from 'clsx';

const variants = {
  success: 'bg-green-900/50 text-green-400 border-green-800',
  error: 'bg-red-900/50 text-red-400 border-red-800',
  warning: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
  info: 'bg-blue-900/50 text-blue-400 border-blue-800',
  default: 'bg-gray-800 text-gray-300 border-gray-700',
};

export default function Badge({ variant = 'default', children, className }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
