import serial
import serial.tools.list_ports
import threading
import time
import re
from milk_parser import parse_milk_data

class SerialReader:
    def __init__(self, callback):
        self.serial_port = None
        self.is_running = False
        self.callback = callback
        self.thread = None

    def get_ports(self):
        """Returns a list of available COM ports."""
        ports = serial.tools.list_ports.comports()
        return [port.device for port in ports]

    def connect(self, port_name, baud_rate=2400):
        """Connects to the specified serial port."""
        if self.serial_port and self.serial_port.is_open:
            self.disconnect()

        try:
            self.serial_port = serial.Serial(port_name, baud_rate, timeout=1)
            self.is_running = True
            self.thread = threading.Thread(target=self._read_loop, daemon=True)
            self.thread.start()
            return True, "Connected"
        except  serial.SerialException as e:
            if "Access is denied" in str(e):
                 return False, "Port is busy. Close other apps."
            if "device attached to the system is not functioning" in str(e) or "PermissionError" in str(e):
                 return False, "Device Glitch. UNPLUG and REPLUG cable!"
            return False, str(e)
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

    def _read_loop(self):
        """Internal loop to read data from the serial port.

        Uses a regex-based packet scanner instead of a character-triggered
        reset.  The pattern requires ALL bytes between '(' and ')' to be
        ASCII digits, so a single noise byte or decode error can never shift
        the packet boundary and cause fat=6 to appear as 60.
        """
        buffer = ""
        # Match a complete fat-machine packet: '(' + 26-32 digits + ')'
        # 26-32 covers both the 28-char and 29-char variants seen in the wild.
        packet_re = re.compile(r'\((\d{26,32})\)')

        while self.is_running and self.serial_port and self.serial_port.is_open:
            try:
                if self.serial_port.in_waiting > 0:
                    raw_byte = self.serial_port.read()
                    try:
                        char = raw_byte.decode('utf-8')
                    except UnicodeDecodeError:
                        # Skip bad bytes entirely — do NOT add '?' to the buffer.
                        # A '?' inside what looks like a packet would previously
                        # corrupt the parse and leave the buffer mis-aligned for
                        # the next read, causing fat=6 to show as 60.
                        continue

                    buffer += char

                    # Keep buffer from growing unbounded
                    if len(buffer) > 200:
                        buffer = buffer[-100:]

                    # Check if buffer contains a complete, valid digit-only packet.
                    # If noise or a partial previous packet sits in front of the
                    # real packet, the regex skips past it automatically.
                    match = packet_re.search(buffer)
                    if match:
                        full_packet = match.group(0)   # includes '(' and ')'
                        parsed = parse_milk_data(full_packet)
                        if parsed:
                            self.callback(parsed)
                        else:
                            # Send raw data for debugging
                            self.callback({"raw": full_packet, "error": "Parse Failed"})
                        # Consume everything up to and including this packet
                        buffer = buffer[match.end():]
                else:
                    # At 2400 baud (~240 chars/sec), 10ms is plenty.
                    time.sleep(0.01)
            except Exception as e:
                print(f"Serial Read Error: {e}")
                self.is_running = False
                break
