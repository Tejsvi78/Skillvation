// src/utils/otp.js
import crypto from "crypto";

const CHARSET = "ABCDEFGH23456789JKLMNPQRSTUVWXYZ23456789abcdefghi23456789jkmnpqrstuvwxyz23456789";

export function generateOTP(length = 8) {
    let otp = "";
    for (let i = 0; i < length; i++) {
        const index = crypto.randomInt(0, CHARSET.length);
        otp += CHARSET[index];
    }
    return otp;
}
