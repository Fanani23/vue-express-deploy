const fs = require("fs"), path = require("path");
const root = process.argv[2];
const f = path.join(root, "common/compiled/node/express/controller/auth/own.js");
let s = fs.readFileSync(f, "utf8");
if (s.includes("otp_pin")) { console.log("already patched own.js (fixed otp pin)"); process.exit(0); }
const edit = (a, b) => { if (!s.includes(a)) { console.error(`MISSING in own.js: ${a.slice(0, 60)}`); process.exit(1); } s = s.replace(a, b); };

edit(`    if (USE_OTP) {
      if (USE_OTP === 'EMAIL') {`,
`    if (USE_OTP) {
      if (user.otp_pin) return res.status(200).json({ otp: id, fixed: true });
      if (USE_OTP === 'EMAIL') {`);

edit(`      let otpOk = false;
      if (USE_OTP === 'EMAIL') {
        otpOk = await consumeOtpCode(id, pin);
      } else if (USE_OTP !== 'TEST') {`,
`      let otpOk = false;
      if (user.otp_pin) {
        otpOk = String(pin) === String(user.otp_pin);
      } else if (USE_OTP === 'EMAIL') {
        otpOk = await consumeOtpCode(id, pin);
      } else if (USE_OTP !== 'TEST') {`);

fs.writeFileSync(f, s);
console.log("patched own.js (fixed otp pin for accounts with users.otp_pin)");
