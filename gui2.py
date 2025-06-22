import tkinter as tk
from websocket import create_connection
import threading
import json
import time

class BotGUI:
    def __init__(self):
        self.ws = create_connection("ws://localhost:8080")
        self.macro = []

        self.root = tk.Tk()
        self.root.title("Minecraft Bot GUI")

        # Status Frame
        status_frame = tk.Frame(self.root)
        status_frame.pack(pady=5, fill="x")
        self.health_label = tk.Label(status_frame, text="Health: ?")
        self.health_label.pack(side="left", padx=10)
        self.username = tk.Label(status_frame, text="Username: ?")
        self.username.pack(side="left", padx=10,pady=10)
        self.pos_label = tk.Label(status_frame, text="Position: ?")
        self.pos_label.pack(side="right", padx=10)

        # Commands Frame
        self.commands = {
            "Jump": "jump", "Stop Jump": "stop_jump",
            "Go to (100,65,100)": "goto:6:66:-5",
            "Break Stone": "break_stone", "Forward": "forward",
            "Stop Forward": "stop_forward", "Attack": "attack",
            "Dig Down": "digDown", "Build Up": "buildUp",
            "Dig Gold Block": "digGold", "Quit": "quit",
            "Locate Gold": "locateGold", "Kill Zombies": "killZombies",
            "Stop Killing Zombies": "stopKillZombies", "Come to me": "comeToMe",
            "Fight Me": "fightMe", "Clear Queue": "clearQ"
        }

        commands_frame = tk.LabelFrame(self.root, text="Commands")
        commands_frame.pack(padx=5, pady=5, fill="x")

        for i, (label, cmd) in enumerate(self.commands.items()):
            row = i // 2
            col = (i % 2) * 2
            tk.Button(commands_frame, text=label, width=20,
                      command=lambda c=cmd: self.send_command(c)).grid(row=row, column=col, padx=2, pady=2)
            tk.Button(commands_frame, text="+Macro",
                      command=lambda c=cmd: self.add_macro(c)).grid(row=row, column=col + 1, padx=2, pady=2)

        # Custom Commands Frame
        custom_frame = tk.LabelFrame(self.root, text="Custom Commands")
        custom_frame.pack(padx=5, pady=5, fill="x")

        tk.Label(custom_frame, text="Dig Down (blocks):").grid(row=0, column=0, sticky="e")
        self.dig_depth = tk.Entry(custom_frame, width=10)
        self.dig_depth.insert(0, "1")
        self.dig_depth.grid(row=0, column=1)
        tk.Button(custom_frame, text="Dig Down (Custom)", command=self.send_dig_down_custom).grid(row=0, column=2)

        tk.Label(custom_frame, text="Fight Player (name):").grid(row=1, column=0, sticky="e")
        self.player_name = tk.Entry(custom_frame)
        self.player_name.insert(0, "PlayerNameHere")
        self.player_name.grid(row=1, column=1)
        tk.Button(custom_frame, text="Fight Player", command=self.send_fight_with_player).grid(row=1, column=2)

        tk.Label(custom_frame, text="Shoot Player (name):").grid(row=2, column=0, sticky="e")
        self.player_name2 = tk.Entry(custom_frame)
        self.player_name2.insert(0, "PlayerNameHere")
        self.player_name2.grid(row=2, column=1)
        tk.Button(custom_frame, text="Shoot Player", command=self.send_Shoot_at_player).grid(row=2, column=2)

        # Macro Controls Frame
        macro_frame = tk.LabelFrame(self.root, text="Macro Controls")
        macro_frame.pack(padx=5, pady=5, fill="x")

        self.macro_listbox = tk.Listbox(macro_frame, height=6)
        self.macro_listbox.grid(row=0, column=0, rowspan=4, padx=5, pady=5)

        tk.Button(macro_frame, text="Move Up", command=self.move_macro_up).grid(row=0, column=1, sticky="ew", padx=2)
        tk.Button(macro_frame, text="Move Down", command=self.move_macro_down).grid(row=1, column=1, sticky="ew", padx=2)
        tk.Button(macro_frame, text="Delete Selected", command=self.delete_macro_item).grid(row=2, column=1, sticky="ew", padx=2)
        tk.Button(macro_frame, text="Run Macro", command=self.run_macro).grid(row=3, column=1, sticky="ew", padx=2)

        threading.Thread(target=self.listen_to_ws, daemon=True).start()
        self.root.mainloop()

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
                self.health_label.config(text=f"Health: {data['health']}")
                self.username.config(text=f"Username: {data['username']}")
                pos = data['position']
                self.pos_label.config(text=f"Position: {round(pos['x'], 2)}, {round(pos['y'], 2)}, {round(pos['z'], 2)}")
            except:
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

if __name__ == "__main__":
    BotGUI()
