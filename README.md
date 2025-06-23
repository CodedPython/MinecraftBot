# Minecraft Mineflayer Bot with GUI Control
This project is a Minecraft bot built using Mineflayer that performs a variety of tasks and can be controlled primarily through a custom GUI. The bot is capable of:

Building Up: Automatically places blocks beneath itself to ascend. (Each command builds 1 block up)

Digging Down: Mines directly downward. (Each command digs 1 block down, unless specified)

Gold Detection: Scans the area for gold blocks and states where it is.

PvP Mode: Engages in combat with either a inputted player or whoever states "fight me".

Moves to Position: Moves to the player specified in the code (change the "playerUsername" variable in the code) when they state "come to me"

Zombie Kill Aura: The bot will stay in a position and attempt to kill all hostile zombies.

And small scale macro creation! 

# Features
Graphical User Interface (GUI): Most bot actions are triggered through a user-friendly interface.

Chat Commands: A limited set of commands can be issued via in-game chat for quick actions or debugging.

![MinecraftBotV1GUI](https://github.com/user-attachments/assets/8c8bf775-4a7a-4fb7-af06-7abcf9485850)


# Getting Started
Install dependencies:
`npm install mineflayer canvas mineflayer-pathfinder mineflayer-collectblock ws vec3 prismarine-viewer mineflayer-armor-manager mineflayer-pvp minecrafthawkeye`

Run the bot:
`node bot2.js`

Launch the GUI:
`python gui2.py`

# Requirements
Node.js
Python
Minecraft Java Edition server
mineflayer and related plugins (listed in package.json)

# Example Usage
Use the GUI to select the "Locate Gold" mode, and the bot will scan for nearby gold blocks.

Click "Build Up" to make the bot tower upwards using dirt or cobblestone blocks in its inventory.

Type "fight me" in the chat to have the bot start fighting.

Thanks to all the people who made the Mineflayer Library and all its plugins.
