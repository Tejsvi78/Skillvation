const mongoose = require("mongoose");
const mailSender = require("../utils/mailSender");
const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 5 * 60,
    },
});

async function OTPsender(email, otp) {
    try {
        const body = `<h2>Your OTP is ${otp}</h2>`
        const mailResponse = await mailSender(email, "Varification Email from Skillvation", body)
        console.log("Email sent successfully", mailResponse);
    } catch (error) {
        console.log("Error in OTPsender Function", error.message);
        throw error;
    }

}

OTPSchema.pre("save", async function (next) {
    await OTPsender(this.email, this.otp);
    next();
})

const OTP = mongoose.model("OTP", OTPSchema);

module.exports = OTP;