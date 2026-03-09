import { clsx } from 'clsx';

export default function Card({ className, children, ...props }) {
  return (
    <div
      className={clsx(
        'bg-surface-light border border-border rounded-xl p-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
