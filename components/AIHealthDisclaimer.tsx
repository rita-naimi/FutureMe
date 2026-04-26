export function AIHealthDisclaimer({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[0.68rem] leading-relaxed text-slate-400 dark:text-slate-600 ${className}`}>
      Meror is AI-assisted and can make mistakes. It uses evidence-informed health information and your profile, but it is not a medical diagnosis.
    </p>
  );
}
