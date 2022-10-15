import inquirer from "inquirer";
import * as dotenv from "dotenv";
import { env } from "node:process";
import { CookieJar } from "tough-cookie";
import got from "got";
import * as cheerio from "cheerio";
import encrypt from "./encrypt";

dotenv.config();

const cookieJar = new CookieJar();
const USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36 Edg/106.0.1370.42`;

const LOGIN_URL = "https://m.bjyouth.net/site/login";
const { USERNAME, PASSWORD, ORG_ID, TT_USERNAME, TT_PASSWORD } = env;

if (!USERNAME || !PASSWORD) {
  throw new Error("没有登录账户或密码");
}
if (!TT_USERNAME || !TT_PASSWORD) {
  throw new Error("没有TT识图用户名或密码");
}
if (!ORG_ID) {
  throw new Error("没有组织 ID");
}

const loginPage = await got
  .get(LOGIN_URL, {
    cookieJar,
    headers: {
      "User-Agent": USER_AGENT,
    },
  })
  .text();

const $ = cheerio.load(loginPage);
const verifyElement = $("#verifyCode-image");
if (verifyElement.length === 0) {
  throw new Error("找不到验证码");
}
const verifySrc = verifyElement.attr("src");
if (verifySrc === undefined) {
  throw new Error("找不到验证码链接");
}

const captcha = await got.get(new URL(verifySrc, LOGIN_URL), {
  cookieJar,
  headers: {
    "User-Agent": USER_AGENT,
  },
}).buffer();

const captchaBase64 = captcha.toString("base64");

type RecognizeResult =
  | {
      success: false;
      code: "-1";
      message: string;
    }
  | {
      success: true;
      code: "0";
      data: {
        result: string;
        id: string;
      };
    };

const recognizeResult = await got.post("http://api.ttshitu.com/predict", {
  json: {
    username: TT_USERNAME,
    password: TT_PASSWORD,
    image: captchaBase64,
  },
}).json<RecognizeResult>();

if (!recognizeResult.success) {
  throw new Error("验证码识别失败");
}

const csrfMobileCookie = cookieJar
  .getCookiesSync(LOGIN_URL)
  .find((x) => x.key === "_csrf_mobile")
  ?.cookieString();
if (csrfMobileCookie === undefined) {
  throw new Error(`找不到 _csrf_mobile Cookie`);
}

const loginResponse = await got.post(LOGIN_URL, {
  cookieJar,
  body: new URLSearchParams({
    _csrf_mobile: csrfMobileCookie,
    "Login[username]": encrypt(USERNAME),
    "Login[password]": encrypt(PASSWORD),
    "Login[verifyCode]": recognizeResult.data.result,
  }).toString(),
  headers: {
    "User-Agent": USER_AGENT,
    "Content-Type": "application/x-www-form-urlencoded"
  },
});
if (loginResponse.statusCode !== 200) {
  throw new Error(`登录失败：\n${loginResponse.body}`);
}
if (loginResponse.body === "8") {
  throw new Error(`验证码错误`);
}
if (loginResponse.body === "5") {
  throw new Error(`限制登录 5 分钟`);
}
const loginResponseObj: any = eval(`(${loginResponse.body})`);
if (loginResponseObj.rs === "fail") {
  throw new Error(`用户名或密码错误，剩余尝试次数 ${loginResponseObj.time}`);
}

const { id } = await inquirer.prompt<{ id: number }>([
  {
    name: "id",
    type: "number",
    message: "课程 ID",
  },
]);

const checkResponse = await got.post("https://m.bjyouth.net/dxx/check", {
  cookieJar,
  json: { id, org_id: ORG_ID },
});
if (checkResponse.statusCode !== 200) {
  throw new Error(`一键学习失败：\n${await checkResponse.body}`);
}
if (checkResponse.body) {
  throw new Error(`一键学习失败：\n${checkResponse.body}`);
}

console.log("完成。");
