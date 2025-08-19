import { ReactNode } from "react";
import { Sunrise, Sun, Moon } from "lucide-react";

interface PillProps {
  icon: ReactNode;
  label: string;
}

const Pill = ({ icon, label }: PillProps) => (
  <div className="flex flex-col items-start gap-1 w-36 md:w-36 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm hover:shadow-md transition-shadow text-left">
    <div className="grid place-items-center h-5 w-5 rounded-full bg-secondary text-foreground/80">
      {icon}
    </div>
    <span className="text-sm font-medium">{label}</span>
  </div>
);

const MealOptions = () => {
  return (
    <section aria-labelledby="meals" className="pt-8 md:pt-6 pb-8 md:pb-12">
      <h2 id="meals" className="sr-only">Meals</h2>
      <div className="flex flex-row justify-center gap-3 md:gap-6 max-w-3xl mx-auto">
        <Pill icon={<Sunrise className="h- w-4" />} label="Breakfast" />
        <Pill icon={<Sun className="h-3 w-3" />} label="Lunch" />
        <Pill icon={<Moon className="h-3 w-3" />} label="Dinner" />
      </div>
    </section>
  );
};

export default MealOptions;
