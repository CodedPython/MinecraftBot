// Required
const mineflayer = require("mineflayer");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
//const collectBlock = require("mineflayer-collectblock").plugin;
const toolPlugin = require("mineflayer-tool").plugin;
const WebSocket = require("ws");
const vec3 = require("vec3");
const viewer = require("prismarine-viewer").mineflayer;
const armorManager = require("mineflayer-armor-manager");
const pvp = require("mineflayer-pvp").plugin;
const readline = require('readline');
const MineManager = require('./Functions/mineManager');
const {StopKillingZombies, KillZombies, FightEntity, ShootEntity,StopAttack } = require("./Functions/Combat");
const {buildUp, digGold, digDown,locateGold,moveToClosestSide,CollectBlock, GetBlock,Pathfind_To_Goal,taskQueue, state,processTaskQueue } = require("./Functions/Utility");
const {EquipItem, startEating, ConsumeItem,eatWhenHungry } = require("./Functions/BotInventory");
const {HandleCommand} = require("./Functions/CMDInterface");
const minecraftHawkEye = require("minecrafthawkeye").default; // https://github.com/sefirosweb/minecraftHawkEye/tree/master?tab=readme-ov-file
//Create a bot
const bot = mineflayer.createBot({
  host: "localhost",
  port: 25565,
  username: "MacroBot",
  logErrors: false,
});
// Load the bot plugins
bot.loadPlugin(pathfinder);
//bot.loadPlugin(collectBlock);
bot.loadPlugin(pvp);
bot.loadPlugin(toolPlugin)
bot.loadPlugin(armorManager);
bot.loadPlugin(minecraftHawkEye);
// Task Queue and default variables
let defaultMove;

//let mcData;
let playerUsername = "PlayerNameHere";
let blockSearchDistance = 32;

// When the bot spawns, create movements
bot.once("spawn", () => {
  mcData = require("minecraft-data")(bot.version);
  defaultMove = new Movements(bot, mcData);
  bot.pathfinder.setMovements(defaultMove);
  setInterval(async () => {
  if (bot.food < 15 && !state.runningTask) {
      // Temporarily pause queue to eat
      state.runningTask = true;
      await eatWhenHungry(bot);
      state.runningTask = false;
      processTaskQueue();
    }
  }, 1000);
});
bot.on("kicked", (reason) => {
  console.error("Kicked reason:", reason.value);
});
// Create a websocket server on port 8080
const wss = new WebSocket.Server({ port: 8080 });
wss.on("connection", function connection(ws) {
  setInterval(() => {
    if (bot && bot.health !== undefined && bot.entity?.position) {
      ws.send(
        JSON.stringify({
          health: bot.health,
          username: bot.entity.username,
          position: bot.entity.position,
          food: bot.food,
        })
      );
    }
  }, 500);
  // When the websocket server recieves a command from a client
  ws.on("message", async (msg) => {
    const cmd = msg.toString();

    if (cmd.startsWith("goto:")) {
      const [, x, y, z] = cmd.split(":").map(Number);
      bot.pathfinder.setGoal(new goals.GoalBlock(x, y, z));
    } else if (cmd === "break_stone") {
      const block = bot.findBlock({
        matching: bot.registry.blocksByName.stone.id,
        maxDistance: 6,
      });
      if (block) await bot.collectBlock.collect(block);
    } else if (cmd === "jump") {
      bot.setControlState("jump", true);
    } else if (cmd === "stop_jump") {
      bot.setControlState("jump", false);
    } else if (cmd === "forward") bot.setControlState("forward", true);
    else if (cmd === "stop_forward") bot.setControlState("forward", false);
    else if (cmd === "attack") bot.attack(bot.nearestEntity());
    else if (cmd.startsWith("digDown")) {
      const parts = cmd.split(":");
      const count = parts.length > 1 ? parseInt(parts[1], 10) : 1;
      await digDown(bot,count);
    } else if (cmd.startsWith("digBlock")) {
      const parts = cmd.split(":");
      if (!parts[1]) {
        console.warn("There is no block to search for");
        return;
      }
      const blockType = bot.registry.blocksByName[parts[1]];
      CollectBlock(bot, blockType.name);
    } else if (cmd.startsWith("fightWith")) {
      const parts = cmd.split(":");
      const name = parts[1];
      FightEntity(bot, bot.players[name]);
    } else if (cmd.startsWith("shootAt")) {
      const parts = cmd.split(":");
      const name = parts[1];
      ShootEntity(bot, bot.players[name]);
    } else if (cmd === "buildUp") await buildUp(bot);
    else if (cmd === "digGold") await digGold(bot);
    else if (cmd === "locateGold") locateGold(bot,blockSearchDistance);
    else if (cmd === "quit") {
      bot.reconnect = false;
      bot.quit();
    } else if (cmd == "killZombies") {
      KillZombies(bot);
    } else if (cmd === "stopKillZombies") {
      StopKillingZombies(bot);
    } else if (cmd === "comeToMe") {
      const player = bot.players[playerUsername];
      if (!player || !player.entity) return;
      Pathfind_To_Goal(bot, new goals.GoalFollow(player.entity), 1);
    } else if (cmd === "fightMe") {
      //console.log("Fighting player")
      FightEntity(bot, bot.players[playerUsername], "sword");
    } else if (cmd === "shootMe") {
      ShootEntity(bot, bot.players[playerUsername], "bow");
    } else if (cmd === "clearQ") {
      state.runningTask = false;
      taskQueue.splice(0, taskQueue.length);
    } else if (cmd === "get_inventory") {
      const items = bot.inventory.items().map((item) => ({
        name: item.name,
        count: item.count,
        slot: item.slot,
      }));
      ws.send(JSON.stringify({ type: "inventory", items }));
    } else if (cmd === "StopAttack"){
      StopAttack(bot)
    }
  });
});
bot.on("chat", (username, message) => {
  if (username === bot.username) return;
  if (message === "quit") {
    bot.reconnect = false;
    bot.quit();
  } else if (message === "come to me") {
    const player = bot.players[playerUsername];
    if (!player || !player.entity) return;
    Pathfind_To_Goal(bot, new goals.GoalFollow(player.entity), 1);
    //bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 1));
  } else if (message === "locate gold") {
    locateGold(blockSearchDistance);
  } else if (message === "kill zombie") {
    KillZombies(bot);
  } else if (message === "stop kill zombie") {
    StopKillingZombies(bot);
  } else if (message === "fight me") {
    const player = bot.players[username];
    FightEntity(bot, player);
  } else if (message === "shoot me") {
    const player = bot.players[username];
    //ShootProjectile(bot, player.entity);
    bot.hawkEye.autoAttack(player.entity, "bow"); //Weapon and target can be changed.
  } else if (message === "stop") {
    StopAttack(bot);
  } else if (message.startsWith("collect")) {
    const data = message.split(" ");
    if (!data[1]) {
      console.warn("There is no block to search for");
      return;
    }
    const blockType = bot.registry.blocksByName[data[1]];
    CollectBlock(bot, blockType.name);
  }
});
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
  HandleCommand(bot,input.trim());
});