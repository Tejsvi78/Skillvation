const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const { cookieOptions } = require("../utils/options");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

require("dotenv").config();

exports.changePassword = async (req, res) => {
    try {
        const userId = req.payloadInfo.id;
        const oldPassword = req.body.oldPassword?.trim();
        const password = req.body.password?.trim();
        const confirmPassword = req.body.confirmPassword?.trim();

        if (!oldPassword || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Old password is incorrect",
            });
        }

        const isSamePassword = await bcrypt.compare(password, user.password);

        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: "New password cannot be same as old password",
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match",
            });
        }

        user.password = await bcrypt.hash(password, 10);
        user.tokenVersion += 1;

        await user.save();

        res.clearCookie("token", cookieOptions);
        mailSender(
            user.email,
            "Password Changed Successfully",
            "Your password was changed successfully. If this wasn't you, contact support immediately."
        ).catch(err => console.error("Mail error:", err));

        return res.status(200).json({
            success: true,
            message: "Password updated successfully. Please login again.",
        });

    } catch (error) {
        console.error("Change password error:", error);

        return res.status(500).json({
            success: false,
            message: "Error changing password",
            error: error.message,
        });
    }
};


exports.resetPasswordToken = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(200).json({
                success: true,
                message: "User not found for reset password",
            });
        }
        const resetToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;

        await user.save();

        const url = `${process.env.FRONTEND_URL}/update-password/${resetToken}`;

        await mailSender(
            email,
            "Reset Your Password",
            `Click here to reset password:\n${url}\n\nValid for 15 minutes.`
        );

        return res.status(200).json({
            success: true,
            message: "Reset email sent",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "error in reset password token",
            error: error.message,
        });
    }
};



exports.resetPassword = async (req, res) => {
    try {
        const token = req.body.resetPasswordToken?.trim();
        const password = req.body.password?.trim();
        const confirmPassword = req.body.confirmPassword?.trim();

        if (!password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match",
            });
        }
        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Token invalid or expired",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        user.tokenVersion += 1;

        await user.save();

        res.clearCookie("token", cookieOptions);

        return res.status(200).json({
            success: true,
            message: "Password reset successful",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};