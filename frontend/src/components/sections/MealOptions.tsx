import { ReactNode } from "react";
import clsx from "clsx";

interface PillProps {
  icon: ReactNode;
  label: string;
}

const Pill = ({ icon, label }: PillProps) => (
  <div className="flex flex-col items-start gap-1 w-36 md:w-36 rounded-2xl border-2 border-gray-300 px-2 py-1 shadow-sm hover:shadow-md transition-shadow text-left">
    <div className="grid place-items-center h-6 w-6 rounded-full bg-secondary text-foreground/80">
      {icon}
    </div>
    <span className="text-sm font-medium">{label}</span>
  </div>
);

const MealOptions = ({ className = ""}) => {
  return (
    <section aria-labelledby="meals" className={clsx("pb-8 md:pb-12", className || "pt-8 md:pt-6")}>
      <h2 id="meals" className="sr-only">Meals</h2>
      <div className="flex flex-row justify-center gap-3 md:gap-6 max-w-3xl mx-auto">
        <Pill icon={<img src="assets\All Icon Used\vaadin_morning.png" alt="Breakfast" className="h-5 w-5" />} label="Breakfast" />
        <Pill icon={<img src="assets\All Icon Used\mingcute_sun-fill.png" alt="Lunch" className="h-5 w-5" />} label="Lunch" />
        <Pill icon={<img src="assets\All Icon Used\material-symbols-light_clear-night.png" alt="Dinner" className="h-5 w-5" />} label="Dinner" />
      </div>
    </section>
  );
};

export default MealOptions;
