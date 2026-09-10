import { useMilk } from '../context/MilkContext';
import { MetricCard } from './MetricCard';
import { Settings } from './Settings';

export const Dashboard = () => {
    const { data } = useMilk();

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8 font-inter">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                        Milk Analyzer
                    </h1>
                    <p className="text-gray-400 mt-1">Real-time Analysis Dashboard</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500">System Ready</p>
                </div>
            </header>

            <Settings />

            {data ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricCard
                        label="Fat Content"
                        value={data.fat.toFixed(2)}
                        unit="%"
                        color="blue"
                    />
                    <MetricCard
                        label="SNF"
                        value={data.snf.toFixed(2)}
                        unit="%"
                        color="green"
                    />
                    <MetricCard
                        label="Density"
                        value={data.density.toFixed(2)}
                        unit=""
                        color="purple"
                    />
                    <MetricCard
                        label="Added Water"
                        value={data.addedWater.toFixed(2)}
                        unit="%"
                        color="red"
                    />
                    <MetricCard
                        label="Protein"
                        value={data.protein.toFixed(2)}
                        unit="%"
                        color="yellow"
                    />
                    <MetricCard
                        label="Temperature/Lactose"
                        value={data.temperature.toFixed(2)}
                        unit="?"
                        color="gray"
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-800/30">
                    <div className="text-gray-500 text-xl font-medium">No Data Received</div>
                    <p className="text-gray-600 mt-2">Connect to a device and wait for readings...</p>
                </div>
            )}

            {data && (
                <div className="mt-8 p-4 bg-black/40 rounded border border-gray-800 font-mono text-xs text-gray-500">
                    Last Raw Packet: {data.raw}
                </div>
            )}
        </div>
    );
};
