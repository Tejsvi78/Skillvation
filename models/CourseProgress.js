const mongoose = require("mongoose")

const courseProgress_Schema = new mongoose.Schema({
    courseID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    completedVideos: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SubSection",
        },
    ],
});
courseProgress_Schema.index(
    { courseID: 1, userId: 1 },
    { unique: true }
);

module.exports = mongoose.model("CourseProgress", courseProgress_Schema);