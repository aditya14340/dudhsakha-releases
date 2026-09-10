import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface MilkData {
    fat: number;
    snf: number;
    density: number;
    addedWater: number;
    protein: number;
    temperature: number;
    raw: string;
}

interface MilkContextType {
    data: MilkData | null;
    isConnected: boolean;
    portPath: string;
    connect: (path: string, baudRate?: number) => Promise<{ success: boolean; message: string }>;
    disconnect: () => Promise<{ success: boolean; message: string }>;
    availablePorts: any[];
    refreshPorts: () => Promise<void>;
    error: string | null;
}

const MilkContext = createContext<MilkContextType | undefined>(undefined);

export const MilkProvider = ({ children }: { children: ReactNode }) => {
    const [data, setData] = useState<MilkData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [portPath, setPortPath] = useState('');
    const [availablePorts, setAvailablePorts] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const refreshPorts = async () => {
        try {
            setError(null);
            const ports = await window.ipcRenderer.getPorts();
            setAvailablePorts(ports);
        } catch (error: any) {
            console.error('Failed to list ports', error);
            setError('Failed to list ports: ' + (error.message || String(error)));
        }
    };

    useEffect(() => {
        refreshPorts();

        // Listen for data
        const cleanup = window.ipcRenderer.onSerialData((newData: MilkData) => {
            setData(newData);
        });

        return () => {
            cleanup();
        };
    }, []);

    const connect = async (path: string, baudRate: number = 2400) => {
        const result = await window.ipcRenderer.connectPort(path, baudRate);
        if (result.success) {
            setIsConnected(true);
            setPortPath(path);
        }
        return result;
    };

    const disconnect = async () => {
        const result = await window.ipcRenderer.disconnectPort();
        if (result.success) {
            setIsConnected(false);
            setPortPath('');
        }
        return result;
    };

    return (
        <MilkContext.Provider value={{
            data,
            isConnected,
            portPath,
            connect,
            disconnect,
            availablePorts,
            refreshPorts,
            error
        }}>
            {children}
        </MilkContext.Provider>
    );
};

export const useMilk = () => {
    const context = useContext(MilkContext);
    if (context === undefined) {
        throw new Error('useMilk must be used within a MilkProvider');
    }
    return context;
};
