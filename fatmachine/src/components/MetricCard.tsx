

interface MetricCardProps {
    label: string;
    value: string | number;
    unit?: string;
    color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
    icon?: React.ReactNode;
}

const colorMap = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    gray: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, unit, color = 'blue', icon }) => {
    return (
        <div className={`flex flex-col p-6 rounded-2xl border ${colorMap[color]} backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium opacity-80 uppercase tracking-widest">{label}</h3>
                {icon && <div className="text-2xl opacity-80">{icon}</div>}
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tight">{value}</span>
                {unit && <span className="text-xl opacity-60 font-medium">{unit}</span>}
            </div>
        </div>
    );
};
