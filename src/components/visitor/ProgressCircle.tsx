'use client';

interface ProgressCircleProps {
  position: number;
  total: number;
  isCurrent: boolean;
  displayCode: string;
}

export default function ProgressCircle({ position, total, isCurrent, displayCode }: ProgressCircleProps) {
  const radius = 140;
  const strokeWidth = 10;
  const viewBox = (radius + strokeWidth + 20) * 2;
  const center = viewBox / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.max(0, 1 - (position - 1) / total) : 0;
  const offset = circumference * (1 - (isCurrent ? 1 : progress));

  // Outer decorative ring
  const outerRadius = radius + 18;

  function getMessage(): string {
    if (isCurrent) return "C'est votre tour !";
    if (position === 1) return '-- vous y etes presque !';
    if (position <= 3) return '-- plus que quelques instants';
    return `-- ${position - 1} personne${position > 2 ? 's' : ''} avant vous`;
  }

  return (
    <div className="relative mx-auto" style={{ width: viewBox, height: viewBox, maxWidth: '90vw', maxHeight: '90vw' }}>
      <svg className="h-full w-full" viewBox={`0 0 ${viewBox} ${viewBox}`}>
        {/* Outer soft glow ring */}
        <circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="none"
          stroke={isCurrent ? 'rgba(34,197,94,0.12)' : 'rgba(66,114,184,0.10)'}
          strokeWidth="24"
        />
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="white"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={isCurrent ? '#22c55e' : '#4272b8'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
        <p className="text-base text-gray-500">
          Votre numero est le <strong className="font-black text-gray-900">#{displayCode}</strong>
        </p>
        {isCurrent ? (
          <p className="mt-2 text-4xl font-black leading-tight text-green-600 sm:text-5xl">
            C&apos;est votre tour !
          </p>
        ) : (
          <p className="mt-2 text-center text-4xl font-black leading-tight text-gray-900 sm:text-5xl">
            Vous etes {position}<sup className="text-2xl">o</sup><br />dans la file
          </p>
        )}
        <p className="mt-3 text-base text-gray-500">
          {getMessage()}
        </p>
      </div>
    </div>
  );
}
