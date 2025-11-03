// 📦 farmModule.js — Final Improved Farming Module
const { Vec3 } = require('vec3');
const { GoalNear } = require('mineflayer-pathfinder').goals;

function farmModule(bot, options = {}) {
  const settings = {
    range: options.range || 10,
    interval: options.interval || 30000,
    chestPos: options.chestPos || null,
    crops: options.crops || {
      wheat: { block: 'wheat', mature: 7, seed: 'wheat_seeds', replant: true },
      carrots: { block: 'carrots', mature: 7, seed: 'carrot', replant: true },
      potatoes: { block: 'potatoes', mature: 7, seed: 'potato', replant: true },
      beetroot: { block: 'beetroots', mature: 3, seed: 'beetroot_seeds', replant: true },
      sugar_cane: { block: 'sugar_cane', replant: false, special: 'sugarcane' },
      melon: { block: 'melon', replant: false },
      pumpkin: { block: 'pumpkin', replant: false },
      cocoa: { block: 'cocoa', mature: 2, seed: 'cocoa_beans', replant: true, special: 'cocoa' }
    }
  };

  // --- State ---
  const queue = [];
  let busy = false;
  let farmingEnabled = true;
  let harvestedItems = new Set();

  // --- Queue system ---
  async function processQueue() {
    if (busy || queue.length === 0) return;
    busy = true;
    const job = queue.shift();
    try {
      await job();
    } catch (err) {
      console.log(`⚠️ Farm job error: ${err.message}`);
    }
    busy = false;
    processQueue();
  }

  function enqueue(jobFn) {
    queue.push(jobFn);
    processQueue();
  }

  // --- Utility ---
  async function equipItem(itemName, destination = 'hand') {
    const item = bot.inventory.items().find(i => i.name === itemName);
    if (!item) return false;
    await bot.equip(item, destination);
    return true;
  }

  function findCropBlocks(range = settings.range) {
    return bot.findBlocks({
      matching: block => Object.values(settings.crops).some(c => block.name === c.block),
      maxDistance: range,
      count: 200
    });
  }

  async function goNear(position) {
    await bot.pathfinder.goto(new GoalNear(position.x, position.y, position.z, 1));
  }

    async function collectNearbyDrops(center, radius = 4) {
        for (let attempt = 0; attempt < 3; attempt++) {
            const drops = Object.values(bot.entities).filter(
            e => e.kind === 'Drops' && e.position.distanceTo(center) <= radius
            );
            if (drops.length === 0) return;
            for (const drop of drops) {
            try {
                await bot.pathfinder.goto(new GoalNear(drop.position.x, drop.position.y, drop.position.z, 1));
            } catch {}
            }
            await bot.waitForTicks(10);
        }
    }


  // --- Farming Logic ---
  async function harvestBlock(block) {
    const crop = Object.values(settings.crops).find(c => c.block === block.name);
    if (!crop) return;

    // Sugar cane special logic
    if (crop.special === 'sugarcane') {
      const below = bot.blockAt(block.position.offset(0, -1, 0));
      if (below && below.name === 'sugar_cane') {
        await goNear(block.position);
        const tool = bot.pathfinder.bestHarvestTool(block);
        if (tool) await bot.equip(tool, 'hand');
        await bot.dig(block);
        await bot.waitForTicks(15); // wait ~0.75s after digging
        harvestedItems.add('sugar_cane');
        await collectNearbyDrops(block.position);
      }
      return;
    }

    // Cocoa beans
    if (crop.special === 'cocoa') {
      if (block.metadata >= crop.mature) {
        await goNear(block.position);
        const tool = bot.pathfinder.bestHarvestTool(block);
        if (tool) await bot.equip(tool, 'hand');
        await bot.dig(block);
        await bot.waitForTicks(15); // wait ~0.75s after digging
        harvestedItems.add('cocoa_beans');
        await collectNearbyDrops(block.position);
        if (crop.replant) {
          await equipItem(crop.seed);
          const faceDir = block.getProperties()?.facing || 'north';
          const directionVec = {
            north: new Vec3(0, 0, 1),
            south: new Vec3(0, 0, -1),
            east: new Vec3(-1, 0, 0),
            west: new Vec3(1, 0, 0)
          }[faceDir];
          const jungleLog = bot.blockAt(block.position.plus(directionVec));
          if (jungleLog && jungleLog.name.includes('log')) {
            try {
              await bot.placeBlock(jungleLog, directionVec.scaled(-1));
            } catch {}
          }
        }
      }
      return;
    }

    // Regular crops
    if (typeof crop.mature === 'number' && block.metadata < crop.mature) return;
    await goNear(block.position);
    const tool = bot.pathfinder.bestHarvestTool(block);
    if (tool) await bot.equip(tool, 'hand');

    await bot.dig(block);
    await bot.waitForTicks(15); // wait ~0.75s after digging
    harvestedItems.add(crop.block);
    await collectNearbyDrops(block.position);

    // Replant with retries
    if (crop.replant && crop.seed) {
      const soil = bot.blockAt(block.position.offset(0, -1, 0));
      if (soil && soil.name.includes('farmland')) {
        await equipItem(crop.seed);
        for (let i = 0; i < 3; i++) {
          try {
            await bot.placeBlock(soil, new Vec3(0, 1, 0));
            break;
          } catch {
            await bot.waitForTicks(5);
          }
        }
      }
    }
  }

  async function farmAll() {
    if (!farmingEnabled) return;
    const blocks = findCropBlocks();
    if (blocks.length === 0) return;

    const matureBlocks = blocks.filter(pos => {
      const b = bot.blockAt(pos);
      const c = Object.values(settings.crops).find(c => c.block === b?.name);
      return c && (c.mature === undefined || b.metadata >= c.mature);
    });

    for (const pos of matureBlocks) {
      const block = bot.blockAt(pos);
      if (!block) continue;
      try {
        await harvestBlock(block);
        if (bot.inventory.emptySlotCount() === 0) {
          await depositHarvest();
        }
      } catch (err) {
        console.log(`⚠️ Error harvesting ${block.name}: ${err.message}`);
      }
    }
  }

  async function depositHarvest() {
    if (!settings.chestPos) return;
    if (harvestedItems.size === 0) return; // nothing new
    const chestBlock = bot.blockAt(settings.chestPos);
    if (!chestBlock || !bot.openChest) return;

    console.log('📦 Depositing harvested crops...');
    await goNear(settings.chestPos);

    try {
      const chest = await bot.openChest(chestBlock);
      for (const item of bot.inventory.items()) {
        if (!harvestedItems.has(item.name)) continue;
        if (['wheat_seeds', 'carrot', 'potato', 'cocoa_beans'].includes(item.name)) continue;
        await chest.deposit(item.type, null, item.count);
      }
      chest.close();
      harvestedItems.clear();
      console.log('✅ Deposit complete.');
    } catch (err) {
      console.log(`⚠️ Deposit failed: ${err.message}`);
    }
  }

  async function farmingCycle() {
    if (!farmingEnabled) return;
    console.log('🌾 Farming cycle started...');
    await farmAll();
    await depositHarvest();
    console.log('🌱 Farming cycle complete.');
  }

  // --- Interval farming loop ---
  setInterval(() => enqueue(farmingCycle), settings.interval);

  // --- Exposed Commands ---
  bot.farm = {
    all: () => enqueue(farmAll),
    deposit: () => enqueue(depositHarvest),
    cycle: () => enqueue(farmingCycle),
    toggle: () => {
      farmingEnabled = !farmingEnabled;
      console.log(farmingEnabled ? '🌱 Farming resumed.' : '🛑 Farming paused.');
    }
  };

  console.log('✅ Improved Auto-Farming module loaded with drop collection and smart deposits.');
}

module.exports = farmModule;
