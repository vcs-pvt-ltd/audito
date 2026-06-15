import { Clock, Building, Target } from "lucide-react";

const stats = [
  { icon: Clock, value: "70%", label: "Time Saved", color: "text-secondary-400" },
  { icon: Building, value: "500+", label: "Companies", color: "text-accent-400" },
  { icon: Target, value: "99.9%", label: "Accuracy", color: "text-secondary-400" },
];

export default function StatsSection() {
  return (
    <section className="py-20 border-t border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full glass mb-4">
                  <Icon size={22} className={stat.color} />
                </div>
                <p className={`text-4xl sm:text-5xl font-bold ${stat.color} mb-2`}>
                  {stat.value}
                </p>
                <p className="text-gray-400 text-sm">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
