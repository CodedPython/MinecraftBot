let lastHeldItem;
let warnNoFood = true;
let botFood = "bread";
let startEatFoodInterval;

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
function startEating(bot) {
  if (startEatFoodInterval) return;
  startEatFoodInterval = setInterval(async () => {
    ConsumeItem(bot, botFood);
  }, 3000);
}
function EquipItem(bot, itemWanted,hand="hand") {
  const itemToEquip = bot.inventory
    .items()
    .find((item) => item.name.includes(itemWanted));
  if (itemToEquip) {
    bot.equip(itemToEquip, hand);
    return true;
  } else {
    return false;
  }
}
async function eatWhenHungry(bot) {
  if (bot.food <= 18) { // hunger threshold
    try {
      console.log('Eating to restore hunger...');
      await ConsumeItem(bot)
      console.log('Done eating.');
    } catch (err) {
      console.log('Failed to eat:', err);
    }
  }
}
module.exports = {EquipItem, startEating, ConsumeItem,eatWhenHungry };