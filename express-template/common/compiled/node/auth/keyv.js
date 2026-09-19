let keyv;
const setTokenService = service => (keyv = service);
const setRefreshToken = async (id, refresh_token) => keyv.set(String(id), refresh_token);
const getRefreshToken = async id => keyv.get(String(id));
const revokeRefreshToken = async id => keyv.delete(String(id));

// EMAIL one-time codes: short-lived, single-use, attempt-limited. Keys are namespaced so they can
// never collide with refresh tokens (which are keyed by the bare user id).
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const setOtpCode = async (id, code) => {
  await keyv.set(`otp:${id}`, code, OTP_TTL_MS);
  await keyv.set(`otp-attempts:${id}`, 0, OTP_TTL_MS);
};
/** Returns true and consumes the code when it matches; false otherwise. Wipes the code after too many misses. */
const consumeOtpCode = async (id, pin) => {
  const expected = await keyv.get(`otp:${id}`);
  if (!expected) return false;
  if (String(pin) === String(expected)) {
    await keyv.delete(`otp:${id}`);
    await keyv.delete(`otp-attempts:${id}`);
    return true;
  }
  const attempts = ((await keyv.get(`otp-attempts:${id}`)) || 0) + 1;
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await keyv.delete(`otp:${id}`);
    await keyv.delete(`otp-attempts:${id}`);
  } else {
    await keyv.set(`otp-attempts:${id}`, attempts, OTP_TTL_MS);
  }
  return false;
};

const setUserService = () => {};
const setRefreshTokenStoreName = () => {};
const setAuthUserStoreName = () => {};
const findUser = () => {};
const updateUser = () => {};

export {
  consumeOtpCode,
  setOtpCode,
  findUser,
  getRefreshToken,
  revokeRefreshToken,
  setAuthUserStoreName,
  setRefreshToken,
  setRefreshTokenStoreName,
  setTokenService,
  setUserService,
  updateUser,
};
