require("dotenv").config();

exports.cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development",
    sameSite: "Strict",

};