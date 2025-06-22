// Required
const mineflayer = require("mineflayer");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const collectBlock = require("mineflayer-collectblock").plugin;
const WebSocket = require("ws");
const vec3 = require("vec3");
const viewer = require("prismarine-viewer").mineflayer;
const armorManager = require("mineflayer-armor-manager");
const pvp = require("mineflayer-pvp").plugin;
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
bot.loadPlugin(collectBlock);
bot.loadPlugin(pvp);
bot.loadPlugin(armorManager);
bot.loadPlugin(minecraftHawkEye);
// Task Queue and default variables
const taskQueue = [];
let runningTask = false;
let defaultMove;
let zombieAttackInterval;
let mcData;
let playerUsername = "PlayerNameHere";
let warnUserMelee = true;
function enqueueTask(taskFn) {
  taskQueue.push(taskFn);
  processTaskQueue();
}

function processTaskQueue() {
  if (runningTask || taskQueue.length === 0) return;

  runningTask = true;
  const task = taskQueue.shift();

  Promise.resolve()
    .then(() => task())
    .catch((err) => console.error("Task failed:", err.message))
    .finally(() => {
      runningTask = false;
      process.nextTick(processTaskQueue);
    });
}
// When the bot spawns, create movements
bot.once("spawn", () => {
  mcData = require("minecraft-data")(bot.version);
  defaultMove = new Movements(bot, mcData);
  bot.pathfinder.setMovements(defaultMove);
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
      await digDown(count);
    } else if (cmd.startsWith("fightWith")) {
      const parts = cmd.split(":");
      const name = parts[1];
      fightPlayer(bot, bot.players[name]);
    } else if (cmd.startsWith("shootAt")) {
      const parts = cmd.split(":");
      const name = parts[1];
      ShootPlayer(bot, bot.players[name]);
    } else if (cmd === "buildUp") await buildUp();
    else if (cmd === "digGold") await digGold();
    else if (cmd === "locateGold") locateGold(32);
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
      fightPlayer(bot, bot.players[playerUsername], "sword");
    } else if (cmd==="shootMe"){
      ShootPlayer(bot, bot.players[playerUsername], "bow")
    } else if (cmd==="clearQ"){
      runningTask = false;
      taskQueue.splice(0, taskQueue.length);
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
    locateGold(32);
  } else if (message === "kill zombie") {
    KillZombies(bot);
  } else if (message === "stop kill zombie") {
    StopKillingZombies(bot);
  } else if (message === "fight me") {
    const player = bot.players[username];
    fightPlayer(bot, player);
  } else if (message === "shoot me") {
    const player = bot.players[username];
    //ShootProjectile(bot, player.entity);
    bot.hawkEye.autoAttack(player.entity, "crossbow"); //Weapon and target can be changed.
  } else if (message === "stop") {
    bot.hawkEye.stop();
  }
});
function digDown(count = 1) {
  enqueueTask(async () => {
    for (let i = 0; i < count; i++) {
      const blockPos = bot.entity.position.offset(0, -1, 0);
      const block = bot.blockAt(blockPos);

      if (!block || block.name === "air" || !bot.canDigBlock(block)) break;

      try {
        await bot.tool.equipForBlock(block);
        await bot.dig(block);
        await bot.waitForTicks(5); // time to fall
      } catch (err) {
        console.error("Dig error:", err.message);
        break;
      }
    }
  });
}

function buildUp() {
  enqueueTask(async () => {
    const scaffold = bot.inventory
      .items()
      .find((item) => ["dirt", "cobblestone"].includes(item.name));
    if (!scaffold) {
      bot.chat("No scaffold block!");
      return;
    }
    await bot.equip(scaffold, "hand");
    bot.setControlState("jump", true);

    const maxTicks = 40; // 2 seconds max
    for (let i = 0; i < maxTicks; i++) {
      const below = bot.blockAt(bot.entity.position.offset(0, -1, 0));
      if (below?.name === "air") {
        const placeOn = bot.blockAt(bot.entity.position.offset(0, -1.5, 0));
        if (placeOn) {
          try {
            await bot.placeBlock(placeOn, vec3(0, 1, 0));
            break; // success
          } catch (err) {
            console.warn("Placement error:", err.message);
          }
        }
      }
      await bot.waitForTicks(1);
    }

    bot.setControlState("jump", false);
  });
}

function isGoldBlock(block) {
  return block.name === "gold_block";
}

function digGold() {
  enqueueTask(async () => {
    const block = bot.findBlock({
      matching: (b) => b.name === "gold_block",
      maxDistance: 5,
    });
    if (block) {
      await bot.tool.equipForBlock(block);
      await bot.dig(block);
    } else {
      bot.chat("/tell playerUsername Can't reach gold block");
    }
  });
}
function locateGold(Distance) {
  const blockToLocate = bot.findBlock({
    matching: mcData.blocksByName.gold_block.id,
    maxDistance: Distance,
  });
  if (!blockToLocate) {
    bot.chat("Cant find that block.");
    return;
  }
  const x = blockToLocate.position.x;
  const y = blockToLocate.position.y;
  const z = blockToLocate.position.z;
  bot.chat("Gold Block: " + x + ", " + y + ", " + z);
}
function Pathfind_To_Goal(bot, goal_location) {
  try {
    bot.pathfinder.setGoal(goal_location);
  } catch (error) {
    console.error("Error when attemping to pathfind:", error);
  }
}
function EquipItem(bot, itemWanted) {
  const itemToEquip = bot.inventory
    .items()
    .find((item) => item.name.includes(itemWanted));
  if (itemToEquip) bot.equip(itemToEquip, "hand");
  return itemToEquip;
}
function KillZombies(bot) {
  if (zombieAttackInterval) return;
  zombieAttackInterval = setInterval(async () => {
    const sword = EquipItem(bot, "sword");
    const axe = EquipItem(bot, "axe");
    if (!sword && !axe && warnUserMelee) {
      console.warn("Bot Doesn't have a melee weapon");
      warnUserMelee = false;
    }
    const mobFilter = (e) => e.type === "hostile" && e.displayName === "Zombie";
    const mob = bot.nearestEntity(mobFilter);
    //console.log(mob)
    if (!mob) return;
    try {
      const pos = mob.position.offset(0, mob.height / 2, 0);
      await bot.lookAt(pos, true);
      bot.attack(mob);
    } catch (error) {
      console.error("Error Code When killing zombies: ", error);
    }
  }, 1000);
}
function StopKillingZombies(bot) {
  clearInterval(zombieAttackInterval);
  warnUserMelee = true;
  zombieAttackInterval = null;
}
function fightPlayer(bot, playerEntity, meleeItem = "sword") {
  if (!playerEntity) return;
  EquipItem(bot, meleeItem);
  bot.pvp.attack(playerEntity.entity);
}
function ShootPlayer(bot, playerEntity, rangedItem = "bow") {
  if (!playerEntity) return;
  EquipItem(bot, rangedItem);
  bot.hawkEye.autoAttack(playerEntity.entity, rangedItem);
}
