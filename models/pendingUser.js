const mongoose = require("mongoose");

const pendingUserSchema = new mongoose.Schema({
    userName: {
        type: String,
        trim: true,
        required: true,
    },
    email: {
        type: String,
        trim: true,
        required: true,
    },
    password: {
        type: String,
        trim: true,
        required: true,
    },
    accountType: {
        type: String,
        trim: true,
        enum: ["Admin", "Student", "Instructor"],
        required: true,
    },
    signupToken: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 2 * 60 * 60,
    }

},

)

module.exports = mongoose.model("pendingUser", pendingUserSchema);