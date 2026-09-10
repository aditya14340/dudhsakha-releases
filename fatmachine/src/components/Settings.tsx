import { useState } from 'react';
import { useMilk } from '../context/MilkContext';

export const Settings = () => {
    const { availablePorts, connect, disconnect, isConnected, portPath, refreshPorts, error } = useMilk();
    const [selectedPort, setSelectedPort] = useState('');
    const [baudRate, setBaudRate] = useState(2400); // Default to 2400 as per plan
    const [statusMsg, setStatusMsg] = useState('');

    const handleConnect = async () => {
        if (!selectedPort) return;
        setStatusMsg('Connecting...');
        const result = await connect(selectedPort, baudRate);
        setStatusMsg(result.message);
    };

    const handleDisconnect = async () => {
        setStatusMsg('Disconnecting...');
        const result = await disconnect();
        setStatusMsg(result.message);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-200">Connection Settings</h2>

            <div className="flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-2">
                    <label className="text-sm text-gray-400">COM Port</label>
                    <div className="flex gap-2">
                        <select
                            value={selectedPort}
                            onChange={(e) => setSelectedPort(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 min-w-[200px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isConnected}
                        >
                            <option value="">
                                {availablePorts.length === 0 ? "No Ports Found" : "Select Port"}
                            </option>
                            {availablePorts.map((port: any) => (
                                <option key={port.path} value={port.path}>
                                    {port.path}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={refreshPorts}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded border border-gray-600 text-gray-300"
                            title="Refresh Ports"
                            disabled={isConnected}
                        >
                            ↻
                        </button>
                    </div>
                    {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
                    {!error && availablePorts.length === 0 && (
                        <div className="text-yellow-500 text-xs mt-1">
                            No ports found. Connect device or check drivers.
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm text-gray-400">Baud Rate</label>
                    <select
                        value={baudRate}
                        onChange={(e) => setBaudRate(Number(e.target.value))}
                        className="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-[120px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isConnected}
                    >
                        <option value={1200}>1200</option>
                        <option value={2400}>2400</option>
                        <option value={4800}>4800</option>
                        <option value={9600}>9600</option>
                        <option value={19200}>19200</option>
                    </select>
                </div>

                <div className="flex gap-2">
                    {!isConnected ? (
                        <button
                            onClick={handleConnect}
                            disabled={!selectedPort}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Connect
                        </button>
                    ) : (
                        <button
                            onClick={handleDisconnect}
                            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-6 rounded transition-colors"
                        >
                            Disconnect
                        </button>
                    )}
                </div>
            </div>

            {statusMsg && (
                <div className={`mt-4 text-sm ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                    status: {statusMsg} {isConnected && `(${portPath})`}
                </div>
            )}
        </div>
    );
};
