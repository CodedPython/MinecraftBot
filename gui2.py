import tkinter as tk
from websocket import create_connection
import threading
import json
import time
import asyncio
import time
class BotGUI:
    def __init__(self):
        self.ws = create_connection("ws://localhost:8080")
        self.macro = []

        self.root = tk.Tk()
        self.root.title("Minecraft Bot GUI")

        self.health_label = tk.Label(self.root, text="Health: ?")
        self.health_label.pack()
        self.pos_label = tk.Label(self.root, text="Position: ?")
        self.pos_label.pack()

        # Available commands
        self.commands = {
            "Jump": "jump",
            "Stop Jump": "stop_jump",
            "Go to (100, 65, 100)": "goto:6:66:-5",
            "Break Stone": "break_stone",
            "Forward": "forward",
            "Stop Forward": "stop_forward",
            "Attack": "attack",
            "Dig Down": "digDown",
            "Build Up": "buildUp",
            "Dig Gold Block": "digGold",
            "Quit":"quit",
            "Locate Gold": "locateGold",
            "Kill Zombies":"killZombies",
            "Stop Killing Zombies": "stopKillZombies",
            "Come to me":"comeToMe",
            "Fight Me": "fightMe"
            
        }

        for label, cmd in self.commands.items():
            frame = tk.Frame(self.root)
            frame.pack()
            tk.Button(frame, text=label, width=20, command=lambda c=cmd: self.send_command(c)).pack(side="left")
            tk.Button(frame, text="+Macro", command=lambda c=cmd: self.add_macro(c)).pack(side="left")
        # Dig Down with Custom Depth
        tk.Label(self.root, text="Dig Down (blocks):").pack()
        self.dig_depth = tk.Entry(self.root)
        self.dig_depth.insert(0, "1")
        self.dig_depth.pack()
        tk.Button(self.root, text="Dig Down (Custom)", command=self.send_dig_down_custom).pack()

        # PVP with Custom Player
        tk.Label(self.root, text="Fight Player (name):").pack()
        self.player_name = tk.Entry(self.root)
        self.player_name.insert(0, "PlayerNameHere")
        self.player_name.pack()
        tk.Button(self.root, text="Fight Player (name)", command=self.send_fight_with_player).pack()
        
        # Shoot arrows at custom player
        tk.Label(self.root, text="Shoot Player (name):").pack()
        self.player_name2 = tk.Entry(self.root)
        self.player_name2.insert(0, "PlayerNameHere")
        self.player_name2.pack()
        tk.Button(self.root, text="Shoot Player (name)", command=self.send_Shoot_at_player).pack()
        
        # Macro display
        tk.Label(self.root, text="Macro").pack()
        self.macro_listbox = tk.Listbox(self.root, height=6)
        self.macro_listbox.pack()

        # Macro controls
        tk.Button(self.root, text="Move Up", command=self.move_macro_up).pack()
        tk.Button(self.root, text="Move Down", command=self.move_macro_down).pack()
        tk.Button(self.root, text="Delete Selected", command=self.delete_macro_item).pack()
        tk.Button(self.root, text="Run Macro", command=self.run_macro).pack()

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
            print("Invalid name for custom fight")
if __name__ == "__main__":
    BotGUI()
