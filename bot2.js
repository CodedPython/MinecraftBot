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
//let mcData;
let playerUsername = "PlayerNameHere";
let warnUserMelee = true;
let blockSearchDistance = 32;
let startEatFoodInterval;
let botFood = "bread"
let warnNoFood = true;
let lastHeldItem;
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
  startEating(bot);
});
//bot.on("entityHurt", (Entity) => {
//  if (Entity === bot.entity) return;
//  bot.chat("Fighting " + Entity.username);
//  FightEntity(bot, Entity);
//});
bot.on("kicked", (reason) => {
  console.error("Kicked reason:", reason.value);
});
bot.on("whisper", (username, message) => {
  if (username === bot.username) return;
  if (message === "ping") bot.chat("/msg " + username + " pong");
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
      await digDown(count);
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
    } else if (cmd === "buildUp") await buildUp();
    else if (cmd === "digGold") await digGold();
    else if (cmd === "locateGold") locateGold(blockSearchDistance);
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
      runningTask = false;
      taskQueue.splice(0, taskQueue.length);
    } else if (cmd === "get_inventory") {
      const items = bot.inventory.items().map((item) => ({
        name: item.name,
        count: item.count,
        slot: item.slot,
      }));
      ws.send(JSON.stringify({ type: "inventory", items }));
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
    bot.hawkEye.stop();
    bot.pvp.stop();
  } else if (message.startsWith("collect")) {
    const data = message.split(" ");
    if (!data[1]) {
      console.warn("There is no block to search for");
      return;
    }
    const blockType = bot.registry.blocksByName[data[1]];
    CollectBlock(bot, blockType.name);
    //CollectBlock(bot, blockType.name, blockSearchDistance);
  } else if (message === "items") {
    console.log(bot.nearestEntity());
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
      bot.chat("Can't reach gold block");
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
  if (itemToEquip) {
    bot.equip(itemToEquip, "hand");
    return true;
  } else {
    return false;
  }
}
function KillZombies(bot) {
  if (zombieAttackInterval) return;
  zombieAttackInterval = setInterval(async () => {
    const sword = EquipItem(bot, "sword");
    //const axe = EquipItem(bot, "axe");
    if (!sword && warnUserMelee) {
      //!axe &&
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
function StopKillingZombies() {
  clearInterval(zombieAttackInterval);
  warnUserMelee = true;
  zombieAttackInterval = null;
}
function FightEntity(bot, Entity, meleeItem = "sword") {
  if (!Entity) return;
  EquipItem(bot, meleeItem);
  bot.pvp.attack(Entity.entity);
}
function ShootEntity(bot, Entity, rangedItem = "bow") {
  if (!Entity) return;
  EquipItem(bot, rangedItem);
  bot.hawkEye.autoAttack(Entity.entity, rangedItem);
}
function startEating(bot) {
  if (startEatFoodInterval) return;
  startEatFoodInterval = setInterval(async () => {
    ConsumeItem(bot, botFood);
  }, 3000);
}
async function ConsumeItem(bot, item = "bread") {
  if (!bot || !item) return;
  lastHeldItem = bot.heldItem ? bot.heldItem.name : null;
  const hunger = bot.food; // 0 to 20
  const maxHunger = 20;
  if (hunger >= maxHunger) return;
  const hasEquipped = await EquipItem(bot, item);
  if (hasEquipped) {
    try {
      await bot.consume();
      console.log(`Bot ate ${item}.`);
      if (lastHeldItem) {
        await EquipItem(bot, lastHeldItem);
        console.log(`Re-equipped previous item: ${lastHeldItem}`);
      }
    } catch (err) {
      console.error("Failed to consume item:", err);
    }
  } else if (warnNoFood && !hasEquipped) {
    console.warn("Bot doesn't have the item:", item);
    warnNoFood = false;
  }
}
function GetBlock(bot, blockName,searchDistance = 32) {
  const block = bot.findBlock({
    matching: mcData.blocksByName[blockName].id,
    maxDistance: searchDistance,
  });
  return block
}
async function CollectBlock(bot, blockType) {
  const block = GetBlock(bot, blockType)


  if (!block) {
    bot.chat("Didn't find the block");
    return;
  }

  // Set the goal
  moveToClosestSide(bot, block);

  // Wait until goal is reached
  await new Promise((resolve) => {
    bot.once("goal_reached", resolve);
  });

  await bot.tool.equipForBlock(block);
  try {
    await bot.dig(block, true, "raycast");
  } catch (error) {
    console.log(error);
  }

  moveForwardOneBlock(bot);
}
// Moves the bot forward by 1 block
function moveForwardOneBlock(bot) {
  const startPos = bot.entity.position.clone();

  bot.setControlState("forward", true);

  const interval = setInterval(() => {
    const dist = bot.entity.position.distanceTo(startPos);
    if (dist >= 1.0) {
      bot.setControlState("forward", false);
      clearInterval(interval);
    }
  }, 50); // check every 50ms
}


function moveToClosestSide(bot, block) {
  const { GoalBlock } = require('mineflayer-pathfinder').goals;
  const sides = [
    block.position.offset(1, 0, 0),
    block.position.offset(-1, 0, 0),
    block.position.offset(0, 0, 1),
    block.position.offset(0, 0, -1),
    block.position.offset(0, 1, 0),
    block.position.offset(0, -1, 0)
  ];

  const closest = sides.reduce((a, b) => {
    const da = bot.entity.position.distanceTo(a);
    const db = bot.entity.position.distanceTo(b);
    return da < db ? a : b;
  });

  bot.pathfinder.setGoal(new GoalBlock(closest.x, closest.y, closest.z));
}

