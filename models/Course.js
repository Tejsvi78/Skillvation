const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
    courseName: {
        type: String,
        required: true,
    },
    description: {
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
    instructor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    price: {
        type: Number,
    },
    ratingAndReviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "RatingAndReviews",
    }],
    avgRating: {
        type: Number,
        default: 0,
    },
    totalRatings: {
        type: Number,
        default: 0,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,

        ref: "Category",
    },
    enrolledStudents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    instructions: {
        type: [String],
    },
    totalStudents: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ["Draft", "Published"],
    },
    totalDuration: {
        type: Number,
        default: 0
    },
    completionStatus: {
        type: String,
        enum: ["Active", "Completed"],
        default: "Active"
    },
    totalEarning: {
        type: Number,
        default: 0
    },
    totalVideos: {
        type: Number,
        default: 0
    },
    tag: {
        type: [String],
        required: true,
    },
    thumbnail: {
        url: {
            type: String,
        },
        public_id: {
            type: String,
        }
    },

},
    {
        timestamps: {
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
        },
    }
)

module.exports = mongoose.model("Course", courseSchema);