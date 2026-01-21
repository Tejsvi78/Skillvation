const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
    courseName: {
        type: String,
        required: true,
    },
    discription: {
        type: String,
        required: true,
    },
    whatYouLearn: {
        type: String,
        required: true,
    },
    content: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Section",
    }],
    instructor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    price: {
        type: Number,
    },
    ratingAndReviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "RatingAndReviews",
    }],
    category: {
        type: mongoose.Schema.Types.ObjectId,

        ref: "Category",
    },
    enrolledStudents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    tag: {
        type: [String],
        required: true,
    },
    thumbnail: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
},
    { timestamps: true }
)

module.exports = mongoose.model("Course", courseSchema);