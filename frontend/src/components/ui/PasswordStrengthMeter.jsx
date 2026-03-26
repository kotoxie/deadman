export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;

  const checks = [
    password.length >= 8,
    password.length >= 12,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length; // 0–6

  const levels = [
    { label: 'Very Weak',  color: 'bg-red-500',    text: 'text-red-400' },
    { label: 'Weak',       color: 'bg-red-400',    text: 'text-red-400' },
    { label: 'Fair',       color: 'bg-yellow-500', text: 'text-yellow-400' },
    { label: 'Good',       color: 'bg-yellow-400', text: 'text-yellow-400' },
    { label: 'Strong',     color: 'bg-green-500',  text: 'text-green-400' },
    { label: 'Very Strong',color: 'bg-green-400',  text: 'text-green-400' },
    { label: 'Excellent',  color: 'bg-emerald-400',text: 'text-emerald-400' },
  ];
  const level = levels[Math.min(score, levels.length - 1)];
  const pct = Math.round((score / 6) * 100);

  return (
    <div className="space-y-1">
      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${level.color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span className={level.text}>{level.label}</span>
        <span className="text-gray-500">
          {!checks[0] && 'min 8 chars · '}
          {!checks[2] && 'uppercase · '}
          {!checks[4] && 'number · '}
          {!checks[5] && 'symbol'}
        </span>
      </div>
    </div>
  );
}
