import tkinter as tk
import threading
import json
import time
import ttkbootstrap as ttkb
from ttkbootstrap.constants import *
from websocket import create_connection

class BotGUI:
    def __init__(self):
        self.ws = create_connection("ws://localhost:8080")
        self.macro = []

        self.root = ttkb.Window(themename="darkly")  # Dark theme
        self.style = self.root.style
        self.themes = {"dark": "darkly", "light": "flatly"}
        self.current_theme = "dark"

        self.toggle_btn = ttkb.Button(self.root, text="Switch to Light Theme", 
                                      command=self.toggle_theme)
        self.toggle_btn.pack(pady=5)

        self.root.title("Minecraft Bot GUI")
        self.root.geometry("700x600")

        self.notebook = ttkb.Notebook(self.root, bootstyle="dark")
        self.notebook.pack(expand=True, fill="both", padx=5, pady=5)

        # Tabs
        self.status_tab = ttkb.Frame(self.notebook)
        self.commands_tab = ttkb.Frame(self.notebook)
        self.custom_tab = ttkb.Frame(self.notebook)
        self.macro_tab = ttkb.Frame(self.notebook)
        self.inventory_tab = ttkb.Frame(self.notebook)
        self.notebook.add(self.status_tab, text="🩺 Status")
        self.notebook.add(self.inventory_tab, text="📦 Inventory")
        self.notebook.add(self.commands_tab, text="🎮 Commands")
        self.notebook.add(self.custom_tab, text="⚙️ Custom")
        self.notebook.add(self.macro_tab, text="📜 Macros")
        self.create_status_tab()
        self.create_commands_tab()
        self.create_custom_tab()
        self.create_macro_tab()
        self.create_inventory_tab()
        threading.Thread(target=self.listen_to_ws, daemon=True).start()
        self.root.mainloop()

    def create_status_tab(self):
        status_frame = ttkb.Frame(self.status_tab, padding=10)
        status_frame.pack(fill="x")
        self.username = ttkb.Label(status_frame, text="Username: ?", font=("Segoe UI", 12))
        self.username.pack(side="top", padx=10)
        self.health_label = ttkb.Label(status_frame, text="Health: ?", font=("Segoe UI", 12))
        self.health_label.pack(side="top", padx=10)
        self.pos_label = ttkb.Label(status_frame, text="Position: ?", font=("Segoe UI", 12))
        self.pos_label.pack(side="top", padx=10)
        self.food_label = ttkb.Label(status_frame, text="Food: ?", font=("Segoe UI", 12))
        self.food_label.pack(side="top",padx=10)

    def create_commands_tab(self):
        self.commands = {
            "Jump": "jump", "Stop Jump": "stop_jump",
            "Go to (100,65,100)": "goto:6:66:-5",
            "Break Stone": "break_stone", "Forward": "forward",
            "Stop Forward": "stop_forward", "Attack": "attack",
            "Dig Down": "digDown", "Build Up": "buildUp",
            "Dig Gold Block": "digGold", "Quit": "quit",
            "Locate Gold": "locateGold", "Kill Zombies": "killZombies",
            "Stop Killing Zombies": "stopKillZombies", "Come to me": "comeToMe",
            "Fight Me": "fightMe", "Clear Queue": "clearQ", "Shoot Me": "shootMe", 
            "Stop Attack":"StopAttack"
        }

        commands_frame = ttkb.LabelFrame(self.commands_tab, text="Bot Commands")
        commands_frame.pack(padx=5, pady=5, fill="both", expand=True)

        for i, (label, cmd) in enumerate(self.commands.items()):
            row = i // 2
            col = (i % 2) * 2
            ttkb.Button(commands_frame, text=label, width=22,
                        command=lambda c=cmd: self.send_command(c)).grid(row=row, 
                                                                         column=col, padx=2, pady=2)
            ttkb.Button(commands_frame, text="+Macro", width=8,
                        command=lambda c=cmd: self.add_macro(c)).grid(row=row, 
                                                                      column=col + 1, padx=2, pady=2)

    def create_custom_tab(self):
        custom_frame = ttkb.LabelFrame(self.custom_tab, text="Custom Commands")
        custom_frame.pack(padx=5, pady=5, fill="x")

        ttkb.Label(custom_frame, text="Dig Down (blocks):").grid(row=0, column=0, sticky="e")
        self.dig_depth = ttkb.Entry(custom_frame, width=10)
        self.dig_depth.insert(0, "1")
        self.dig_depth.grid(row=0, column=1)
        ttkb.Button(custom_frame, text="Dig Down", 
                    command=self.send_dig_down_custom).grid(row=0, column=2)

        ttkb.Label(custom_frame, text="Fight Player (name):").grid(row=1,
                                                                   column=0,
                                                                   sticky="e")
        self.player_name = ttkb.Entry(custom_frame)
        self.player_name.insert(0, "PlayerNameHere")
        self.player_name.grid(row=1, column=1)
        ttkb.Button(custom_frame, text="Fight", command=self.send_fight_with_player).grid(row=1, column=2)

        ttkb.Label(custom_frame, text="Shoot Player (name):").grid(row=2, column=0, sticky="e")
        self.player_name2 = ttkb.Entry(custom_frame)
        self.player_name2.insert(0, "PlayerNameHere")
        self.player_name2.grid(row=2, column=1)
        ttkb.Button(custom_frame, text="Shoot", command=self.send_Shoot_at_player).grid(row=2, column=2)
        
        ttkb.Label(custom_frame, text="Dig Block (name):").grid(row=3, column=0, sticky="e")
        self.dig_block = ttkb.Entry(custom_frame)
        self.dig_block.insert(0, "oak_log")
        self.dig_block.grid(row=3, column=1)
        ttkb.Button(custom_frame, text="Dig", command=self.send_dig_block).grid(row=3, column=2)

    def create_macro_tab(self):
        macro_frame = ttkb.LabelFrame(self.macro_tab, text="Macro Controls")
        macro_frame.pack(padx=5, pady=5, fill="x")

        self.macro_listbox = tk.Listbox(macro_frame, height=8)
        self.macro_listbox.grid(row=0, column=0, rowspan=4, padx=5, pady=5)

        ttkb.Button(macro_frame, text="Move Up", command=self.move_macro_up).grid(row=0, column=1, sticky="ew", padx=2)
        ttkb.Button(macro_frame, text="Move Down", command=self.move_macro_down).grid(row=1, column=1, sticky="ew", padx=2)
        ttkb.Button(macro_frame, text="Delete Selected", command=self.delete_macro_item).grid(row=2, column=1, sticky="ew", padx=2)
        ttkb.Button(macro_frame, text="Run Macro", command=self.run_macro).grid(row=3, column=1, sticky="ew", padx=2)

    def send_command(self, cmd):
        self.ws.send(cmd)

    def add_macro(self, cmd):
        self.macro.append(cmd)
        self.refresh_macro_listbox()

    def run_macro(self):
        for cmd in self.macro:
            self.send_command(cmd)
            time.sleep(0.5)

    def move_macro_up(self):
        idx = self.macro_listbox.curselection()
        if idx and idx[0] > 0:
            i = idx[0]
            self.macro[i - 1], self.macro[i] = self.macro[i], self.macro[i - 1]
            self.refresh_macro_listbox()
            self.macro_listbox.selection_set(i - 1)

    def move_macro_down(self):
        idx = self.macro_listbox.curselection()
        if idx and idx[0] < len(self.macro) - 1:
            i = idx[0]
            self.macro[i + 1], self.macro[i] = self.macro[i], self.macro[i + 1]
            self.refresh_macro_listbox()
            self.macro_listbox.selection_set(i + 1)
    def delete_macro_item(self):
        idx = self.macro_listbox.curselection()
        if idx:
            del self.macro[idx[0]]
            self.refresh_macro_listbox()
    def refresh_macro_listbox(self):
        self.macro_listbox.delete(0, tk.END)
        for cmd in self.macro:
            self.macro_listbox.insert(tk.END, cmd)
    def listen_to_ws(self):
        while True:
            try:
                msg = self.ws.recv()
                data = json.loads(msg)
                if isinstance(data, dict) and data.get("type") == "inventory":
                    inventory_list = "\n".join(
                        f"{item['count']}x {item['name']} (slot {item['slot']})" 
                        for item in data["items"]
                    )
                    self.inv_text.delete("1.0", tk.END)
                    self.inv_text.insert(tk.END, inventory_list)
                elif isinstance(data, dict) and all(k in data for k in ("health", "username", "position", "food")):
                    self.health_label.config(text=f"Health: {round(data['health'],2)}")
                    self.username.config(text=f"Username: {data['username']}")
                    self.food_label.config(text=f"Food: {round(data['food'], 2)}")
                    pos = data["position"]
                    self.pos_label.config(
                        text=f"Position: {round(pos['x'], 2)}, {round(pos['y'], 2)}, {round(pos['z'], 2)}"
                    )
            except Exception as e:
                print("WebSocket error:", e)
                break
    def send_dig_down_custom(self):
        try:
            count = int(self.dig_depth.get())
            if count > 0:
                self.ws.send(f"digDown:{count}")
        except ValueError:
            print("Invalid number for dig down")
    def send_fight_with_player(self):
        try:
            name = self.player_name.get()
            self.ws.send(f"fightWith:{name}")
        except ValueError:
            print("Invalid name for custom fight")
    def send_Shoot_at_player(self):
        try:
            name = self.player_name2.get()
            self.ws.send(f"shootAt:{name}")
        except ValueError:
            print("Invalid name for shoot command")
    def send_dig_block(self):
        try:
            name = self.dig_block.get()
            self.ws.send(f"digBlock:{name}")
        except ValueError:
            print("Invalid name for dig command")
    def toggle_theme(self):
        self.current_theme = "light" if self.current_theme == "dark" else "dark"
        new_theme = self.themes[self.current_theme]
        self.style.theme_use(new_theme)
        self.toggle_btn.config(text=f"Switch to {'Dark' if self.current_theme == 'light' else 'Light'} Theme")
    def create_inventory_tab(self):
        frame = ttkb.LabelFrame(self.inventory_tab, text="Bot Inventory", padding=10)
        frame.pack(fill="both", expand=True)
        self.inv_text = tk.Text(frame, wrap="word", height=20)
        self.inv_text.pack(expand=True, fill="both", padx=10, pady=10)
        refresh_btn = ttkb.Button(frame, text="Refresh Inventory", command=self.request_inventory)
        refresh_btn.pack(pady=5)
    def request_inventory(self):
        self.ws.send("get_inventory")


if __name__ == "__main__":
    BotGUI()
