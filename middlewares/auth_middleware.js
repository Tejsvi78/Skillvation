const jwt = require("jsonwebtoken");
const User = require("../models/User");
require("dotenv").config();

exports.authentication = async (req, res, next) => {
    try {

        // const token = req.body.token;         // parse token from request body


        // const token = req.header("Authorization").replace("Bearer ", "");    //parse token from request header by passing token in header.


        const token = req.cookies.token;     //parse token from request cookies if token is stored in cookies.

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token is not present."
            })
        }
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(payload.id);

            if (!user || user.tokenVersion !== payload.tokenVersion) {
                return res.status(401).json({
                    success: false,
                    message: "Session expired. Login again.",
                });
            }
            req.payloadInfo = payload;
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: "Token is not varified",
                error: err.message,
            })
        }

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Something went wrong.",
            error: error.message,
        })
    }

}


exports.isPatient = (req, res, next) => {
    try {

        if (req.payloadInfo.role !== "patient") {
            return res.status(403).json({
                success: false,
                message: "Sorry! Doctor is not allowed for this protected route."
            })
        }
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Unable to find Role",
            error: error.message,
        })
    }

}

exports.isDoctor = (req, res, next) => {
    try {

        if (req.payloadInfo.role !== "doctor") {
            return res.status(403).json({
                success: false,
                message: "Sorry! Patient is not allowed for this protected route."
            })
        }
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Unable to find Role",
            error: error.message,
        })
    }

}