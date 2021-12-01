require("dotenv").config();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const encryptPassword = (password) => {
  return crypto.createHash("sha512").update(password).digest("base64");
};

const setAuth = async (req, res, next) => {
  const authorization = req.headers.authorization;
  const [bearer, key] = authorization.split(" ");
  if (bearer !== "Bearer")
    return res.send({ error: "접근 권한이 없습니다." }).status(400);

  if (!key)
    return res.send({ error: "사용자를 찾을 수 없습니다." }).status(404);

  jwt.verify(key, process.env.ACCESS_TOKEN_SECRET, (error, user) => {
    if (error) {
      return res.send({ error: "토큰이 유효하지 않습니다." }).status(403);
    }
    req.user = user;
    next();
  });
};

const token = () => {
  return {
    public(id) {
      return jwt.sign({ id }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "60m"
      });
    },
    secret(id) {
      return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: "24h"
      });
    }
  };
};

const getCoinPrice = async (req, res) => {
  const _coinName = req.params.coinName.toLowerCase();
  const coinId = {
    bitcoin: "bitcoin",
    ethereum: "ethereum",
    dogecoin: "dogecoin",
    ripple: "ripple",
    cardano: "cardano",
    eos: "eos"
  };
  const targetCoin = coinId[_coinName];
  if (targetCoin === undefined)
    return res
      .status(400)
      .json({
        error:
          "지원하지 않는 코인입니다.(지원하는 코인 : BITCOIN / ETHEREUM / DOGECOIN / RIPPLE / CARDANO / EOS)"
      });

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${targetCoin}&vs_currencies=usd`;
  const apiRes = await axios.get(url);
  const data = apiRes.data;
  const price = data[targetCoin].usd;

  return { data: data, price: price };
};

module.exports = {
  encryptPassword,
  setAuth,
  getCoinPrice,
  token
};
