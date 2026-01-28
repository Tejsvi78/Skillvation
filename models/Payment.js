const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    instructor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
        required: true,
        index: true,
    },

    orderId: {
        type: String,
        required: true,
        unique: true,
    },

    paymentId: {
        type: String,
    },

    amount: {
        type: Number,
        required: true,
    },

    platformFee: {
        type: Number,
        required: true,
    },

    instructorEarning: {
        type: Number,
        required: true,
    },

    currency: {
        type: String,
        default: "INR",
    },

    status: {
        type: String,
        enum: ["CREATED", "SUCCESS", "FAILED", "REFUNDED"],
        default: "CREATED",
    },

    paymentMethod: {
        type: String,
    },

    payoutStatus: {
        type: String,
        enum: ["PENDING", "PAID"],
        default: "PENDING",
    },

}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
