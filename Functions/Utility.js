const taskQueue = [];
state = { runningTask: false };
const vec3 = require("vec3");

function enqueueTask(taskFn) {
  taskQueue.push(taskFn);
  processTaskQueue();
}
function processTaskQueue() {
  if (state.runningTask || taskQueue.length === 0) return;

  state.runningTask = true;
  const task = taskQueue.shift();

  Promise.resolve()
    .then(() => task())
    .catch((err) => console.error("Task failed:", err.message))
    .finally(() => {
      state.runningTask = false;
      process.nextTick(processTaskQueue);
    });
}
function GetBlock(bot, blockName, searchDistance = 32) {
  const block = bot.findBlock({
    matching: mcData.blocksByName[blockName].id,
    maxDistance: searchDistance,
  });
  return block;
}
async function CollectBlock(bot, blockType) {
  const block = GetBlock(bot, blockType);

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
    while (!await bot.dig(block, true, "raycast")) {
        await sleep(50); // small delay
    }
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
async function clickItemByName(bot, targetName, clickType = 'left') {
  // Get the open window (server selector, chest, inventory, etc.)
  const window = bot.currentWindow || bot.inventory;
  if (!window) {
    console.warn(`[${bot.username}] No window is currently open.`);
    return;
  }

  // Try to find the item by its display name or item name
  const item = window.slots.find(
    (i) => i && (
      i.displayName?.toLowerCase().includes(targetName.toLowerCase()) ||
      i.name?.toLowerCase().includes(targetName.toLowerCase())
    )
  );

  if (!item) {
    console.warn(`[${bot.username}] Could not find item "${targetName}".`);
    return;
  }

  const slot = item.slot;
  const button = clickType === 'right' ? 1 : 0; // right or left click

  console.log(`[${bot.username}] Clicking "${item.displayName || item.name}" in slot ${slot}`);
  await bot.clickWindow(slot, button, 0);
}
async function waitForWindow(bot, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for window')), timeout);
    bot.once('windowOpen', (window) => {
      clearTimeout(timer);
      resolve(window);
    });
  });
}

async function clickItemInWindow(bot, itemName, clickType = 'left', closeAfter = true) {
  const window = bot.currentWindow || bot.inventory;
  if (!window) throw new Error('No window is open.');

  const item = window.slots.find(
    (i) => i && (
      i.displayName?.toLowerCase().includes(itemName.toLowerCase()) ||
      i.name?.toLowerCase().includes(itemName.toLowerCase())
    )
  );
  if (!item) throw new Error(`Item "${itemName}" not found in window.`);

  const slot = item.slot;
  const button = clickType === 'right' ? 1 : 0;
  await bot.clickWindow(slot, button, 0);

  console.log(`[${bot.username}] Clicked "${item.displayName || item.name}" in slot ${slot}`);

  if (closeAfter && bot.currentWindow) bot.closeWindow(bot.currentWindow);
}

async function useAndClickMenuItem(bot, itemName, menuItemName, clickType = 'left') {
  // 1. Find the item in inventory (e.g. compass)
  const item = bot.inventory.items().find(
    (i) => i.displayName?.toLowerCase().includes(itemName.toLowerCase()) ||
           i.name?.toLowerCase().includes(itemName.toLowerCase())
  );
  if (!item) throw new Error(`Inventory item "${itemName}" not found.`);

  // 2. Equip it
  await bot.equip(item, 'hand');
  console.log(`[${bot.username}] Equipped ${item.displayName || item.name}`);

  // 3. Use it (right-click)
  bot.activateItem();

  // 4. Wait for the server GUI to open
  const window = await waitForWindow(bot, 5000);
  console.log(`[${bot.username}] Window opened: ${window.title}`);

  // 5. Click the target item in the GUI
  await clickItemInWindow(bot, menuItemName, clickType);

  console.log(`[${bot.username}] Selected "${menuItemName}" from menu.`);
}
function moveToClosestSide(bot, block) {
  const { GoalBlock } = require("mineflayer-pathfinder").goals;
  const sides = [
    block.position.offset(1, 0, 0),
    block.position.offset(-1, 0, 0),
    block.position.offset(0, 0, 1),
    block.position.offset(0, 0, -1),
    block.position.offset(0, 1, 0),
    block.position.offset(0, -1, 0),
  ];

  const closest = sides.reduce((a, b) => {
    const da = bot.entity.position.distanceTo(a);
    const db = bot.entity.position.distanceTo(b);
    return da < db ? a : b;
  });

  bot.pathfinder.setGoal(new GoalBlock(closest.x, closest.y, closest.z));
}
function locateGold(bot,Distance) {
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
function buildUp(bot) {
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
function digGold(bot) {
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
function digDown(bot,count = 1) {
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
function botLog(bot,message){
  console.log(`${bot} : ${message}`);
}
async function safeJump(bot, directionVec) {
  const stepBack = directionVec.scaled(-0.3);
  const pos = bot.entity.position.offset(stepBack.x, 0, stepBack.z);
  await bot.lookAt(pos, true);
  bot.setControlState('forward', false);
  await bot.pathfinder.goto(new GoalNear(pos.x, pos.y, pos.z, 0.1));
  bot.setControlState('forward', true);
  bot.setControlState('jump', true);
  setTimeout(() => bot.setControlState('jump', false), 250);
}
async function safeUseAndClickMenuItem(bot, itemName, menuItemName, clickType = 'left') {
  // 1. Find item in inventory
  const item = bot.inventory.items().find(
    (i) =>
      i &&
      (i.displayName?.toLowerCase().includes(itemName.toLowerCase()) ||
        i.name?.toLowerCase().includes(itemName.toLowerCase()))
  );
  if (!item) throw new Error(`Item "${itemName}" not found in inventory.`);

  await bot.equip(item, 'hand');
  console.log(`[${bot.username}] Equipped ${item.displayName || item.name}`);

  // 2. Try activating it
  bot.activateItem();
  await bot.waitForTicks(10);

  // 3. Get the newest window or fall back to inventory
  let window = bot.currentWindow;
  if (!window) {
    // Wait briefly to see if the window shows up later
    for (let i = 0; i < 20 && !window; i++) {
      await bot.waitForTicks(2);
      window = bot.currentWindow;
    }
  }
  if (!window) {
    console.warn(`[${bot.username}] No window opened; trying inventory search as fallback.`);
    window = bot.inventory;
  }

  // 4. Find menu item inside window/inventory
  const target = window.slots.find(
    (i) =>
      i &&
      (i.displayName?.toLowerCase().includes(menuItemName.toLowerCase()) ||
        i.name?.toLowerCase().includes(menuItemName.toLowerCase()))
  );
  if (!target) throw new Error(`Menu item "${menuItemName}" not found.`);

  const slot = target.slot;
  const button = clickType === 'right' ? 1 : 0;

  try {
    await bot.clickWindow(slot, button, 0);
    console.log(`[${bot.username}] Clicked "${target.displayName || target.name}" (slot ${slot}).`);
  } catch (e) {
    console.warn(`[${bot.username}] clickWindow failed, falling back to chat command if available.`);
  }

  // 5. Optional: close GUI
  if (bot.currentWindow) bot.closeWindow(bot.currentWindow);
}

module.exports = {
    buildUp,
    processTaskQueue,
    digGold, 
    digDown,
    locateGold,
    moveToClosestSide,
    CollectBlock, 
    GetBlock,
    Pathfind_To_Goal,
    taskQueue,
    state,
    botLog,
    clickItemByName,
    clickItemInWindow, 
    useAndClickMenuItem,
    safeUseAndClickMenuItem
};