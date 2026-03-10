'use client';

interface WizardStepHeaderProps {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
}

export function WizardStepHeader({ step, totalSteps, title, description }: WizardStepHeaderProps) {
  return (
    <>
      <p className="text-xs bg-primary/10 text-primary font-medium px-3 py-1 rounded-full mb-3">
        الخطوة {step} من {totalSteps}
      </p>
      <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-1">{title}</h2>
      <p className="text-muted-foreground text-xs sm:text-sm mb-5">{description}</p>
    </>
  );
}
