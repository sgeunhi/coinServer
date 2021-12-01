const express = require("express");
const { body, validationResult } = require("express-validator");
const { User, Coin, Asset, Key } = require("./models");
const { encryptPassword, setAuth, getCoinPrice, token } = require("./utils");
const app = express();

const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post(
  "/register",
  body("email")
    .isEmail()
    .withMessage("올바르지 않은 이메일 형식입니다.")
    .isLength({ max: 100 })
    .withMessage("이메일의 길이는 100자 미만입니다."),
  body("name")
    .isLength({
      min: 4,
      max: 12
    })
    .withMessage("이름의 길이는 4자-12자입니다.")
    .isAlphanumeric()
    .withMessage("영어와 숫자만 사용할 수 있습니다."),
  body("password")
    .isLength({ min: 8, max: 16 })
    .withMessage("비밀번호의 길이는 8자-16입니다."),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    const encryptedPassword = encryptPassword(password);
    let user = null;

    try {
      user = new User({
        name: name,
        email: email,
        password: encryptedPassword
      });
      await user.save();
    } catch (e) {
      return res.status(400).json({ error: "이미 존재하는 이메일입니다." });
    }

    const usdAsset = new Asset({ name: "usd", balance: 10000, user });
    await usdAsset.save();

    const coins = await Coin.find({ isActive: true });
    for (const coin of coins) {
      const asset = new Asset({ name: coin.name, balance: 0, user });
      await asset.save();
    }

    res.status(200).json({ message: "회원가입이 완료되었습니다." });
  }
);

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const encryptedPassword = encryptPassword(password);
  const user = await User.findOne({ email, password: encryptedPassword });

  if (user === null) {
    return res.status(404);
  }

  const key = new Key({
    publicKey: token().public(user),
    secretKey: token().secret(user),
    user
  });
  await key.save();

  res.send({ publicKey: key.publicKey, secretkey: key.secretKey });
});

app.get("/coins", async (req, res) => {
  const coins = await Coin.find({ isActive: true });
  const _coins = [];
  for (const coin of coins) {
    _coins.push(coin.name);
  }

  res.send(_coins);
});

app.get("/balance", setAuth, async (req, res) => {
  const user = req.user;
  const assets = await Asset.find({ user: user.id._id, balance: { $ne: 0 } });
  const _assets = [];
  for (const asset of assets) {
    _assets.push(asset.name + ":" + asset.balance);
  }

  res.send(_assets);
});

app.get("/coin/:coinName", async (req, res) => {
  const coinPrice = (await getCoinPrice(req, res)).data;

  res.send(coinPrice);
});

app.post("/coin/:coinName/buy", setAuth, async (req, res) => {
  const user = req.user;
  const _coinName = req.params.coinName.toLowerCase();
  const price = (await getCoinPrice(req, res)).price;
  let { quantity, all } = req.body;
  let purchaseAmount = price * quantity;
  const balanceOfUsd = await Asset.findOne({ user: user.id._id, name: "usd" });

  if (all === "true") {
    quantity = balanceOfUsd.balance / price;
    if (quantity === 0)
      return res.status(400).json({ error: "잔고가 부족합니다." });
    purchaseAmount = price * quantity;
    await Asset.find({ user: user.id._id }).updateOne(
      { name: "usd" },
      { $inc: { balance: -purchaseAmount } }
    );
    await Asset.find({ user: user.id._id }).updateOne(
      { name: _coinName },
      { $inc: { balance: +quantity } }
    );
    return res.send({ price: price, quantity: quantity });
  }

  if (isNaN(quantity))
    return res.status(400).json({ error: "숫자만 입력할 수 있습니다." });

  if (!Number.isInteger(parseFloat(quantity) * 10000))
    return res.status(400).json({ error: "소수점 4자리까지만 입력해주세요." });

  if (balanceOfUsd.balance < purchaseAmount)
    return res.status(400).json({ error: "잔고가 부족합니다." });

  await Asset.find({ user: user.id._id }).updateOne(
    { name: "usd" },
    { $inc: { balance: -purchaseAmount } }
  );
  await Asset.find({ user: user.id._id }).updateOne(
    { name: _coinName },
    { $inc: { balance: +quantity } }
  );

  res.send({ price: price, quantity: quantity });
});

app.post("/coin/:coinName/sell", setAuth, async (req, res) => {
  const user = req.user;
  const _coinName = req.params.coinName.toLowerCase();
  const price = (await getCoinPrice(req, res)).price;
  let { quantity, all } = req.body;
  let sellAmount = price * quantity;
  const balanceOfCoin = await Asset.findOne({
    user: user.id._id,
    name: _coinName
  });

  if (all === "true") {
    quantity = balanceOfCoin.balance;
    if (quantity === 0)
      return res.status(400).json({ error: "잔고가 부족합니다." });
    sellAmount = price * quantity;
    await Asset.find({ user: user.id._id }).updateOne(
      { name: "usd" },
      { $inc: { balance: +sellAmount } }
    );
    await Asset.find({ user: user.id._id }).updateOne(
      { name: _coinName },
      { $inc: { balance: -quantity } }
    );
    return res.send({ price: price, quantity: quantity });
  }

  if (isNaN(quantity))
    return res.status(400).json({ error: "숫자만 입력할 수 있습니다." });
  if (!Number.isInteger(parseFloat(quantity) * 10000))
    return res.status(400).json({ error: "소수점 4자리까지만 입력해주세요." });

  if (balanceOfCoin.balance < quantity)
    return res.status(400).json({ error: "보유하신 코인이 부족합니다." });

  await Asset.find({ user: user.id._id }).updateOne(
    { name: "usd" },
    { $inc: { balance: +sellAmount } }
  );
  await Asset.find({ user: user.id._id }).updateOne(
    { name: _coinName },
    { $inc: { balance: -quantity } }
  );

  res.send({ price: price, quantity: quantity });
});

app.listen(port, () => {
  console.log(`listening at port:' ${port}...`);
});
