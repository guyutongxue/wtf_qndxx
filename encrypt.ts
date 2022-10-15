import crypto from "node:crypto";

const PUBKEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD5uIDebA2qU746e/NVPiQSBA0Q
3J8/G23zfrwMz4qoip1vuKaVZykuMtsAkCJFZhEcmuaOVl8nAor7cz/KZe8ZCNIn
bXp2kUQNjJiOPwEhkGiVvxvU5V5vCK4mzGZhhawF5cI/pw2GJDSKbXK05YHXVtOA
mg17zB1iJf+ie28TbwIDAQAB
-----END PUBLIC KEY-----`;

export default function (src: string) {
  const cipherText = crypto.publicEncrypt(
    {
      key: PUBKEY,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(src)
  );
  return cipherText.toString("base64");
}
