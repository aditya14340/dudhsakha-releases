"""
Weight Machine Bridge — Reads weight data from serial port at 9600 baud.

Supports THREE weight machine string formats:
  Format A (old): L+00790  or  L=00790  → digits / 1000 = litres (e.g. 00790 → 0.790 L)
  Format B (new): +0000008.3 Lt         → leading sign + decimal + 'Lt' suffix (e.g. 8.3 L)
  Format C (Kg) : +0000.270 Kg          → leading sign + decimal + 'Kg' suffix (e.g. 0.270 Kg)

Communication with Electron main.js via stdin (commands) / stdout (JSON lines).

Auto Zero:
  send_zero action writes tare/zero commands in ALL common formats so the machine resets to zero.
  Commands tried (in order):
    - 'T\r\n'             (Tare  — most common, e.g. Essae, Mettler, Sartorius)
    - 'Z\r\n'             (Zero  — CAS, A&D, Ohaus)
    - '@\r\n'             (Zero  — some Indian OEM scales)
    - '\x05'              (ENQ   — some older RS-232 scales)
    - '+00000.000 Lt\r\n' (inject formatted zero string — Soham / custom firmware)
"""

import sys
import json
import time
import threading
import re
import serial
import serial.tools.list_ports


class WeightReader:
    def __init__(self, callback):
        self.serial_port = None
        self.is_running = False
        self.callback = callback
        self.thread = None

    def get_ports(self):
        """Returns a list of available COM ports."""
        ports = serial.tools.list_ports.comports()
        return [port.device for port in ports]

    def connect(self, port_name, baud_rate=9600):
        """Connects to the specified serial port with retry for transient errors."""
        if self.serial_port and self.serial_port.is_open:
            self.disconnect()

        max_retries = 2
        retry_delay = 2  # seconds

        for attempt in range(max_retries + 1):
            try:
                self.serial_port = serial.Serial(port_name, baud_rate, timeout=1)
                self.is_running = True
                self.thread = threading.Thread(target=self._read_loop, daemon=True)
                self.thread.start()
                return True, "Connected"
            except serial.SerialException as e:
                error_msg = str(e)
                if "Access is denied" in error_msg:
                    return False, "Port is busy. Close other apps."
                if "device attached to the system is not functioning" in error_msg:
                    if attempt < max_retries:
                        time.sleep(retry_delay)
                        continue  # Retry
                    return False, "Device Glitch. UNPLUG and REPLUG cable!"
                return False, error_msg
            except Exception as e:
                return False, str(e)

    def disconnect(self):
        """Disconnects from the serial port."""
        self.is_running = False
        if self.serial_port:
            try:
                self.serial_port.close()
            except:
                pass
            self.serial_port = None
        return True, "Disconnected"

    def send_zero(self):
        """
        Sends tare/zero commands to the weight machine in ALL common formats.

        Different manufacturers use different zero/tare command bytes.
        We broadcast all known variants so this works across brands:

          Format 1 — 'T\r\n'             : Tare  (Essae, Mettler, Sartorius, Rice Lake)
          Format 2 — 'Z\r\n'             : Zero  (CAS, A&D, Ohaus, Adam)
          Format 3 — '@\r\n'             : Zero  (some Indian OEM / Soham scales)
          Format 4 — '\x05'              : ENQ   (some older RS-232 scales)
          Format 5 — '+00000.000 Lt\r\n' : Formatted zero string inject (custom firmware)
          Format 6 — '+00000.000 Kg\r\n' : Formatted zero string (Kg variant)
          Format 7 — 'L+00000\r\n'       : Format-A zero string
        """
        if not self.serial_port or not self.serial_port.is_open:
            return False, "Not connected"

        # All zero/tare command variants — one of these will match the connected machine
        zero_commands = [
            b'TZ\r\n',              # TZ    — Soham / Indian OEM scales (capital)
            b'T\r\n',               # Tare  — Essae, Mettler, Sartorius, Rice Lake
            b'Z\r\n',               # Zero  — CAS, A&D, Ohaus, Adam
            b'@\r\n',               # Zero  — Indian OEM / Soham scales
            b'\x05',                # ENQ   — older RS-232 scales
            b'+00000.000 Lt\r\n',   # Format-B zero inject — Lt variant
            b'+00000.000 Kg\r\n',   # Format-C zero inject — Kg variant
            b'L+00000\r\n',         # Format-A zero inject
        ]

        sent_count = 0
        errors = []
        for cmd in zero_commands:
            try:
                self.serial_port.write(cmd)
                sent_count += 1
            except Exception as e:
                errors.append(str(e))

        if sent_count > 0:
            return True, f"Zero commands sent ({sent_count} variants)"
        return False, f"Failed to send zero: {'; '.join(errors)}"

    def _read_loop(self):
        """Internal loop to read weight data from the serial port.

        Supports THREE weight string formats:
          Format A (old): L+00790 or L=00790
            - digits / 1000 = litres (e.g. 00790 → 0.790 L)
            - BUT some machines use /100  (e.g. 01550 → 15.5 L)
            - Auto-detected: if raw/1000 < 1.0, tries raw/100 instead.
          Format B (new): +0000008.3 Lt
            - already a decimal with Lt suffix, parse float directly.
          Format C (Kg) : +0000.270 Kg
            - decimal with Kg suffix (e.g. 0.270 Kg), parse float directly.
            - treats Kg value directly as the quantity (Kg ≈ Litres for milk).

        A deduplication guard prevents the same weight value firing twice
        in a row when the machine continuously streams identical packets.
        """
        buffer = ""
        last_sent_quantity = None   # dedup guard: skip identical back-to-back values

        # Format A (old): L+00790 or L=00790  →  integer digits
        # Format B/C   : +0000008.3 Lt  OR  +0000.270 Kg  →  signed/unsigned decimal
        #   [+\-]?  — optional sign (some machines omit it)
        #   (\d+\.\d+) — decimal number
        #   \s* — optional spaces
        #   (?:Kg|kg|KG|Lt|lt|LT|L|l) — unit: Kg or Lt variants
        pattern_a = re.compile(r'[A-Z]{0,3}L[=+](\d{4,8})')  # 4–8 digits: handles both 5-digit (L+00790) and 8-digit (L+00094000) formats
        pattern_b = re.compile(r'[+\-]?(\d+\.\d+)\s*(?:Kg|kg|KG|Lt|lt|LT|L(?!t)|l(?!t))')

        while self.is_running and self.serial_port and self.serial_port.is_open:
            try:
                if self.serial_port.in_waiting > 0:
                    raw_bytes = self.serial_port.read(self.serial_port.in_waiting)
                    try:
                        chunk = raw_bytes.decode('ascii', errors='ignore')
                    except:
                        chunk = ''

                    # Remove null bytes
                    chunk = chunk.replace('\x00', '')
                    buffer += chunk

                    # Keep buffer reasonable
                    if len(buffer) > 500:
                        buffer = buffer[-200:]

                    # --- Try Format B/C first (+0000008.3 Lt  OR  +0000.270 Kg) ---
                    matches_b = list(pattern_b.finditer(buffer))
                    if matches_b:
                        last_match = matches_b[-1]
                        weight_litres = round(float(last_match.group(1)), 3)

                        # Detect unit for logging (Kg vs Lt)
                        matched_text = last_match.group(0)
                        unit = "Kg" if any(k in matched_text for k in ['Kg','kg','KG']) else "Lt"
                        fmt  = "C" if unit == "Kg" else "B"

                        # Only fire if value changed (dedup guard)
                        if weight_litres != last_sent_quantity:
                            last_sent_quantity = weight_litres
                            self.callback({
                                "quantity": weight_litres,
                                "raw_value": last_match.group(1),
                                "unit": unit,
                                "raw": buffer[-60:],
                                "format": fmt
                            })
                        # Trim buffer past this match so we don't re-fire on stale data
                        buffer = buffer[last_match.end():]

                    # --- Fallback: Try Format A (L+00790) ---
                    else:
                        matches_a = list(pattern_a.finditer(buffer))
                        if matches_a:
                            last_match = matches_a[-1]
                            raw_value = int(last_match.group(1))

                            # Smart divisor by digit count:
                            #   8-digit  → ÷10000   (e.g. 00094000 → 9.400 Lt)
                            #   5-digit high  → ÷100   (e.g. 01550 → 15.50 Lt, if ÷1000 < 1.0)
                            #   5-digit normal → ÷1000  (e.g. 00790 → 0.790 Lt)
                            num_digits = len(last_match.group(1))
                            if num_digits >= 7:
                                weight_litres = round(raw_value / 10000, 3)
                                scale_used = "10000"
                            elif raw_value / 1000 < 1.0 and raw_value / 100 >= 1.0:
                                weight_litres = round(raw_value / 100, 3)
                                scale_used = "100"
                            else:
                                weight_litres = round(raw_value / 1000, 3)
                                scale_used = "1000"

                            # Only fire if value changed (dedup guard)
                            if weight_litres != last_sent_quantity:
                                last_sent_quantity = weight_litres
                                self.callback({
                                    "quantity": weight_litres,
                                    "raw_value": raw_value,
                                    "raw": buffer[-60:],
                                    "format": f"A/{scale_used}"
                                })
                            # Trim buffer past this match so we don't re-fire on stale data
                            buffer = buffer[last_match.end():]
                else:
                    # At 9600 baud (~960 chars/sec), 10ms is tight enough
                    time.sleep(0.01)
            except serial.SerialException as e:
                self.callback({"error": f"Serial Error: {str(e)}"})
                self.is_running = False
                break
            except Exception as e:
                self.callback({"error": f"Read Error: {str(e)}"})
                time.sleep(0.1)


def data_callback(data):
    """Callback for when data is received from the weight machine."""
    try:
        print(json.dumps({"type": "data", "payload": data}), flush=True)
    except Exception as e:
        print(json.dumps({"type": "error", "message": f"Callback Error: {str(e)}"}), flush=True)


def main():
    try:
        reader = WeightReader(data_callback)

        # Send initial status
        print(json.dumps({"type": "status", "payload": "Weight Bridge Ready"}), flush=True)

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

                elif action == "send_zero":
                    # Send tare/zero commands to the weight machine in all common formats
                    success, msg = reader.send_zero()
                    print(json.dumps({
                        "type": "zero_result",
                        "success": success,
                        "message": msg
                    }), flush=True)

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
