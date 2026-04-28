"use client";
import { clsx } from "clsx";

interface Props {
  step: 1 | 2 | 3 | 4;
  totalSteps?: 4;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function WizardShell({ step, totalSteps = 4, title, subtitle, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="text-sm font-semibold text-gray-900">SMM Studio</div>
          <div className="text-xs text-gray-500">
            Step {step} di {totalSteps}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
            <div
              key={n}
              className={clsx(
                "h-1.5 flex-1 rounded-full",
                n <= step ? "bg-violet-600" : "bg-gray-200",
              )}
              aria-label={`Step ${n}`}
            />
          ))}
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          {children}
        </div>
      </div>
    </div>
  );
}
