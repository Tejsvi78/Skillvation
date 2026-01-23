
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookie = require("cookies");
const validator = require("validator");
const crypto = require("crypto");
const OTP = require("../models/OTP");
const { generateOTP } = require("../utils/generateOTP");
const pendingUser = require("../models/pendingUser");
const mailSender = require("../utils/mailSender");
const User = require("../models/User");


require("dotenv").config();

exports.signupUser = async (req, res, next) => {
    try {
        // const { userName, email, password, accountType} = req.body;
        const userName = req.body.userName?.trim();
        const email = req.body.email?.trim().toLowerCase();
        const password = req.body.password?.trim();
        const confirmPassword = req.body.confirmPassword?.trim();
        const accountType = req.body.accountType?.trim().toLowerCase();

        if (!userName || !email || !password || !confirmPassword || !accountType) {
            return res.status(400).json({
                success: false,
                message: "please fill all details.",
            })
        }
        if (!validator.isEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address.",
            })
        }
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long."
            });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Password and confirmPassword should be same."
            });
        }

        if (await User.findOne({ email })) {
            return res.status(409).json({
                success: false,
                message: "User already exists."
            })
        }



        const otp = generateOTP(8);
        const hashedOtp = await bcrypt.hash(otp, 10);
        console.log("otp generated and hashed.")

        await OTP.findOneAndUpdate(
            { email },
            {
                otp: hashedOtp,
                createdAt: Date.now(),
            },
            { upsert: true }
        );
        console.log("entry in OTP model.");
        let hashedPassword;
        try {
            hashedPassword = await bcrypt.hash(password, 10);
        } catch (err) {
            res.status(500).json({
                success: false,
                message: "Failed  to Hash password."
            })
        }

        const signupToken = crypto.randomBytes(32).toString("hex");
        console.log("signupToken created");
        await pendingUser.findOneAndUpdate(
            { email },
            { userName, email, password: hashedPassword, accountType, signupToken, createdAt: Date.now() },
            { upsert: true }
        );
        console.log("entry in pendingUser model");
        await mailSender(email, "Email Verification", `Your OTP is ${otp}`);

        res.setHeader("x-signup-token", signupToken);
        res.status(201).json({
            success: true,
            message: "Email send to user Successfully",
            signupToken,
            header: req.headers,

        })
        next();

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Faild to Create User",
            error: error.message
        })
    }

}

exports.verifySignupOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        // console.log("Header", req.headers)
        const signupToken = req.get("x-signup-token")?.trim();
        console.log("x-signup-token:- ", signupToken);

        if (!signupToken || !otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid verification request"
            });
        }
        const waitingUser = await pendingUser.findOne({ signupToken: signupToken });
        console.log("waitingUser:- ", waitingUser);
        if (!waitingUser) {
            return res.status(403).json({
                success: false,
                message: "Signup session expired or invalid"
            });
        }
        const otpDoc = await OTP.findOne({ email: waitingUser.email });
        if (!otpDoc) {
            return res.status(400).json({ success: false, message: "OTP expired or not found" });
        }

        const isValid = await bcrypt.compare(otp, otpDoc.otp);
        if (!isValid) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }




        const newUser = await User.create({
            userName: waitingUser.userName,
            email: waitingUser.email,
            password: waitingUser.password,
            accountType: waitingUser.accountType.toLowerCase(),
            userImage: `https://avatar.oxro.io/avatar.svg?name=${waitingUser.userName}&background=f39c12`,
        });


        await OTP.deleteOne({ email: waitingUser.email });
        await pendingUser.deleteOne({ email: waitingUser.email });

        const userObj = newUser.toObject();
        userObj.password = undefined;

        res.status(201).json({
            success: true,
            message: "Email verified & user created",
            data: userObj
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Verification failed",
            error: err.message,
        });
    }
};


exports.loginUser = async (req, res) => {
    try {

        const email = req.body.email?.trim().toLowerCase();
        const password = req.body.password?.trim();
        const accountType = req.body.accountType?.trim().toLowerCase();

        if (!email || !password || !accountType) {
            return res.status(400).json({
                success: false,
                message: "please fill all details.",
            })
        }
        if (!validator.isEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address.",
            })
        }

        let existingUser = await User.findOne({ email });
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: "User not registered."
            })
        }
        if (accountType !== existingUser.accountType) {
            return res.status(400).json({
                success: false,
                message: "Please recheck your 'Role'"
            })
        }


        if (await bcrypt.compare(password, existingUser.password)) {

            const payload = {
                email: existingUser.email,
                accountType: existingUser.accountType,
                id: existingUser._id,
            }

            let token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "2h", });
            const userobj = existingUser.toObject();
            userobj.token = token;
            userobj.password = undefined;
            const options = {
                httpOnly: true,
                secure: process.env.NODE_ENV === "development",
                sameSite: "Strict",
                maxAge: 2 * 60 * 60 * 1000
            }

            return res.cookie("token", token, options).status(200).json({
                success: true,
                message: `Welcome back ${existingUser.userName}`,
                data: userobj,
                token
            })

        } else {
            return res.status(401).json({
                success: false,
                message: "Incorrect Password",
            })
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            data: "Login failed",
            message: error.message,
        })
    }
}