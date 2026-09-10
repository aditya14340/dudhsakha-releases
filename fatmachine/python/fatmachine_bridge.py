import sys
import json
import time
import threading
from serial_reader import SerialReader

def data_callback(data):
    """Callback for when data is received from the machine."""
    try:
        print(json.dumps({"type": "data", "payload": data}), flush=True)
    except Exception as e:
        print(json.dumps({"type": "error", "message": f"Callback Error: {str(e)}"}), flush=True)

def main():
    try:
        # DEBUG LOGGING
        with open('bridge_debug.log', 'w') as f:
            f.write(f"Bridge started at {time.time()}\n")
            
        # Initialize SerialReader with our callback
        reader = SerialReader(data_callback)
        
        # Send initial status
        print(json.dumps({"type": "status", "payload": "Bridge Ready"}), flush=True)

        # Command loop
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                command = json.loads(line)
                action = command.get("action")
                
                if action == "list_ports":
                    ports = reader.get_ports()
                    print(json.dumps({"type": "ports", "payload": ports}), flush=True)
                    
                elif action == "connect":
                    port = command.get("port")
                    baud = command.get("baud", 9600)
                    
                    # Ensure disconnect first if already connected/running
                    if reader.is_running:
                        reader.disconnect()

                    success, msg = reader.connect(port, baud)
                    print(json.dumps({
                        "type": "connection_status", 
                        "connected": success, 
                        "message": msg,
                        "port": port
                    }), flush=True)
                    
                elif action == "disconnect":
                    success, msg = reader.disconnect()
                    print(json.dumps({"type": "connection_status", "connected": False, "message": msg}), flush=True)
                    
                elif action == "ping":
                    print(json.dumps({"type": "pong"}), flush=True)
            
            except json.JSONDecodeError:
                print(json.dumps({"type": "error", "message": "Invalid JSON command"}), flush=True)
            except Exception as e:
                print(json.dumps({"type": "error", "message": f"Command Error: {str(e)}"}), flush=True)

    except Exception as e:
        print(json.dumps({"type": "fatal_error", "message": str(e)}), flush=True)

if __name__ == "__main__":
    main()
