'use client';

interface ProgressCircleProps {
  position: number;
  total: number;
  isCurrent: boolean;
}

export default function ProgressCircle({ position, total, isCurrent }: ProgressCircleProps) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.max(0, 1 - (position - 1) / total) : 0;
  const offset = circumference * (1 - (isCurrent ? 1 : progress));

  return (
    <div className="relative mx-auto h-52 w-52">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
        {/* Background circle */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
        />
        {/* Progress arc */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={isCurrent ? '#22c55e' : '#4272b8'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {isCurrent ? (
          <span className="text-lg font-bold text-green-500">
            C&apos;est votre tour!
          </span>
        ) : (
          <>
            <span className="text-4xl font-black text-gray-900">{position}</span>
            <span className="text-sm text-gray-500">
              {position === 1 ? 'personne avant vous' : 'personnes avant vous'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
