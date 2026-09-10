import serial
import serial.tools.list_ports
import time

def diagnose():
    print("=== SERIAL DIAGNOSTIC TOOL ===")
    
    # 1. List Ports
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        print("No serial ports found!")
        return

    print("Available Ports:")
    for i, p in enumerate(ports):
        print(f"{i}: {p.device} - {p.description}")
    
    target_port = ports[0].device
    
    # Priority selection:
    # 1. Look for "CH340" (The driver user is using)
    # 2. Look for "USB" (Generic USB Serial)
    # 3. Look for "COM12" or "COM14" (User mentioned ports)
    
    found_priority = False
    for p in ports:
        desc_upper = p.description.upper()
        if "CH340" in desc_upper:
            target_port = p.device
            found_priority = True
            break
            
    if not found_priority:
        for p in ports:
             if "USB" in p.description.upper():
                 target_port = p.device
                 found_priority = True
                 break

    if not found_priority:
        for p in ports:
            if "COM12" in p.device or "COM14" in p.device:
                target_port = p.device
                break

    print(f"\nTesting Port: {target_port}")
    
    # 2. Test Baud Rates
    bauds = [2400, 4800, 9600, 19200, 38400, 57600, 115200]
    
    for baud in bauds:
        print(f"\n--- Testing Baud Rate: {baud} ---")
        try:
            ser = serial.Serial(target_port, baud, timeout=2)
            # Clear buffer
            ser.reset_input_buffer()
            
            start_time = time.time()
            data_received = False
            
            print("Listening for 3 seconds...")
            while time.time() - start_time < 3:
                if ser.in_waiting:
                    raw = ser.read(ser.in_waiting)
                    try:
                        decoded = raw.decode('utf-8', errors='replace')
                        print(f"RAW HEX: {raw.hex().upper()}")
                        print(f"DECODED: {decoded}")
                        
                        # Check for meaningful data pattern (starts with '(')
                        if "(" in decoded:
                            print(f"✅ SUCCESS! Likely correct baud rate: {baud}")
                    except Exception:
                        print(f"RAW HEX: {raw.hex().upper()}")
                    
                    data_received = True
                else:
                    time.sleep(0.1)
            
            if not data_received:
                print("No data received.")
                
            ser.close()
            
        except serial.SerialException as e:
            print(f"❌ Error opening port at {baud}: {e}")
            if "Access is denied" in str(e):
                print("⚠️ CRITICAL: Port is busy. Close other apps!")
                return

if __name__ == "__main__":
    diagnose()
