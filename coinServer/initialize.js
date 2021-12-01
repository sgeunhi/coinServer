const { User, Coin, Asset, Key } = require("./models");

const init = async () => {
  await User.deleteMany();
  await Asset.deleteMany();
  await Coin.deleteMany();
  await Key.deleteMany();
  const coins = ["bitcoin", "ethereum", "ripple", "dogecoin", "cardano", "eos"];

  for (const _coin of coins) {
    const coin = new Coin({ name: _coin, isActive: true });
    await coin.save();
  }

  console.log("completed");
};

init();
