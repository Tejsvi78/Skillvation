const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
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
    userImage: {
        type: String,
        trim: true,
        required: true,
    },
    accountType: {
        type: String,
        trim: true,
        enum: ["admin", "student", "instructor"],
        default: "Student",
        required: true,
    },
    active: {
        type: Boolean,
        default: true,
    },
    approved: {
        type: Boolean,
        default: true,
    },
    token: {
        type: String,
    },
    courses: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
        },
    ],
    courseProgress: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CourseProgress",
        },
    ],


},
    { timestamps: true }
)

module.exports = mongoose.model("User", userSchema);