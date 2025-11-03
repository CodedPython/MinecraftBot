let zombieAttackInterval;
let warnUserMelee = true;
const {EquipItem} = require("./BotInventory");
function StopAttack(bot){
    bot.hawkEye.stop();
    bot.pvp.stop();
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

module.exports = {StopKillingZombies, KillZombies, FightEntity, ShootEntity,StopAttack };