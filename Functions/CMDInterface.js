function HandleCommand(bot,cmd) {
  if (cmd.startsWith('say ')) {
    bot.chat(cmd.slice(4));
  } else if (cmd === 'pos') {
    console.log(`Position: ${bot.entity.position}`);
  } else if (cmd === 'jump') {
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 500);
  } else {
    console.log(`Unknown command: ${cmd}`);
  }
}

module.exports = {HandleCommand};