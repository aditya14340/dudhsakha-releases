import customtkinter as ctk
import tkinter as tk
from serial_reader import SerialReader
import threading

class MilkAnalyzerApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Milk Analyzer Interface")
        self.geometry("800x600")
        
        # Determine theme
        ctk.set_appearance_mode("Dark")
        ctk.set_default_color_theme("blue")

        self.serial_reader = SerialReader(self.on_data_received)
        
        self.create_layout()
        self.refresh_ports()

    def create_layout(self):
        # Sidebar for controls
        self.sidebar = ctk.CTkFrame(self, width=200, corner_radius=0)
        self.sidebar.pack(side="left", fill="y", padx=0, pady=0)

        self.logo_label = ctk.CTkLabel(self.sidebar, text="Milk Analyzer", font=ctk.CTkFont(size=20, weight="bold"))
        self.logo_label.pack(padx=20, pady=(20, 10))

        # Port Selection
        self.port_label = ctk.CTkLabel(self.sidebar, text="Select COM Port:", anchor="w")
        self.port_label.pack(padx=20, pady=(10, 0))
        
        self.port_option_menu = ctk.CTkOptionMenu(self.sidebar, values=["Scanning..."])
        self.port_option_menu.pack(padx=20, pady=(0, 10))

        # Baud Rate Selection
        self.baud_label = ctk.CTkLabel(self.sidebar, text="Baud Rate:", anchor="w")
        self.baud_label.pack(padx=20, pady=(10, 0))
        
        self.baud_option_menu = ctk.CTkOptionMenu(self.sidebar, values=["2400", "4800", "9600", "115200"])
        self.baud_option_menu.pack(padx=20, pady=(0, 10))
        self.baud_option_menu.set("2400")

        self.refresh_btn = ctk.CTkButton(self.sidebar, text="Refresh Ports", command=self.refresh_ports)
        self.refresh_btn.pack(padx=20, pady=5)

        # Connect Button
        self.connect_btn = ctk.CTkButton(self.sidebar, text="Connect", fg_color="green", command=self.toggle_connection)
        self.connect_btn.pack(padx=20, pady=20)

        # Connection Status
        self.status_label = ctk.CTkLabel(self.sidebar, text="Status: Disconnected", text_color="gray")
        self.status_label.pack(padx=20, pady=10)

        # Main Data Area
        self.main_frame = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        self.main_frame.pack(side="right", fill="both", expand=True, padx=20, pady=20)

        # Dashboard Grid
        self.create_metrics_grid()

        # Raw Data Display
        self.raw_data_label = ctk.CTkLabel(self.main_frame, text="Raw Data: -", font=ctk.CTkFont(size=12, family="Consolas"), text_color="gray", anchor="w")
        self.raw_data_label.grid(row=4, column=0, columnspan=2, sticky="ew", pady=(20, 0))

    def create_metrics_grid(self):
        self.metrics = {}
        fields = [("Fat", "%"), ("SNF", "%"), ("Density", "Kg/L"), ("Added Water", "%"), ("Protein", "%"), ("Temperature", "°C")]
        
        for i, (name, unit) in enumerate(fields):
            card = ctk.CTkFrame(self.main_frame)
            card.grid(row=i//2, column=i%2, padx=10, pady=10, sticky="nsew")
            
            self.main_frame.grid_columnconfigure(i%2, weight=1)
            self.main_frame.grid_rowconfigure(i//2, weight=1)

            label = ctk.CTkLabel(card, text=name, font=ctk.CTkFont(size=16))
            label.pack(pady=(20, 5))
            
            value_label = ctk.CTkLabel(card, text="--.--", font=ctk.CTkFont(size=40, weight="bold"))
            value_label.pack(pady=5)
            
            unit_label = ctk.CTkLabel(card, text=unit, font=ctk.CTkFont(size=14), text_color="gray")
            unit_label.pack(pady=(0, 20))

            self.metrics[name.lower()] = value_label

    def refresh_ports(self):
        ports = self.serial_reader.get_ports()
        if not ports:
            self.port_option_menu.configure(values=["No Ports found"])
            self.port_option_menu.set("No Ports found")
        else:
            self.port_option_menu.configure(values=ports)
            self.port_option_menu.set(ports[0])

    def toggle_connection(self):
        if self.serial_reader.is_running:
            success, msg = self.serial_reader.disconnect()
            if success:
                self.connect_btn.configure(text="Connect", fg_color="green")
                self.status_label.configure(text="Status: Disconnected", text_color="gray")
                self.port_option_menu.configure(state="normal")
                self.baud_option_menu.configure(state="normal")
                self.reset_dashboard()
        else:
            selected_port = self.port_option_menu.get()
            if selected_port == "No Ports found" or not selected_port:
                return
            
            baud_rate = int(self.baud_option_menu.get())
            
            # Update UI to "Connecting..." state
            self.connect_btn.configure(text="Connecting...", state="disabled", fg_color="orange")
            self.status_label.configure(text="Status: Attempting connection...", text_color="orange")
            self.port_option_menu.configure(state="disabled")
            self.baud_option_menu.configure(state="disabled")

            # Run connection in separate thread to prevent UI freeze
            threading.Thread(target=self._perform_connect, args=(selected_port, baud_rate), daemon=True).start()

    def _perform_connect(self, port, baud):
        success, msg = self.serial_reader.connect(port, baud)
        self.after(0, lambda: self._on_connect_result(success, msg))

    def _on_connect_result(self, success, msg):
        self.connect_btn.configure(state="normal")
        
        if success:
            self.connect_btn.configure(text="Disconnect", fg_color="red")
            self.status_label.configure(text="Status: Connected", text_color="green")
        else:
            self.connect_btn.configure(text="Connect", fg_color="green")
            self.port_option_menu.configure(state="normal")
            self.baud_option_menu.configure(state="normal")
            
            # Custom error message for user
            err_text = "Please select valid COM serial cable. Device not found."
            self.status_label.configure(text=f"Error: {err_text}\n({msg})", text_color="red")

    def on_data_received(self, data):
        # Update UI in thread-safe way
        # Since tkinter isn't thread safe, we shouldn't update directly from the serial thread.
        # But for simple label updates, sometimes it works, or we use after().
        # Best practice: use .after to schedule update on main thread.
        self.after(0, lambda: self.update_dashboard(data))

    def update_dashboard(self, data):
        mapping = {
            "fat": "fat",
            "snf": "snf",
            "density": "density",
            "added water": "added_water",
            "protein": "protein",
            "temperature": "temperature" # mapped "temperature" in key to "Temperature" in UI, logic handled below
        }
        
        for ui_key, label_widget in self.metrics.items():
            # ui_key is lower case "fat", "added water"
            # data keys are "fat", "added_water"
            
            data_key = mapping.get(ui_key)
            if data_key and data_key in data:
                print(f"Updating {ui_key} with {data[data_key]}")
                label_widget.configure(text=f"{data[data_key]:.2f}")
        
        # Update Raw Data
        if "raw" in data:
            raw_text = data["raw"]
            if "error" in data:
                 self.raw_data_label.configure(text=f"Raw: {raw_text} (Error: {data['error']})", text_color="orange")
            else:
                 self.raw_data_label.configure(text=f"Raw: {raw_text}", text_color="gray")

    def reset_dashboard(self):
        """Resets all metrics to default state."""
        for label in self.metrics.values():
            label.configure(text="--.--")
        self.raw_data_label.configure(text="Raw Data: -", text_color="gray")


if __name__ == "__main__":
    app = MilkAnalyzerApp()
    app.mainloop()
