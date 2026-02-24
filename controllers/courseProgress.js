const CourseProgress = require("../models/CourseProgress");

exports.updateCompletedVideo = async (req, res) => {
    try {
        const { courseID, subSectionID, completed } = req.body;
        const userId = req.user.id;

        const updateOperation = completed
            ? { $addToSet: { completedVideos: subSectionID } }
            : { $pull: { completedVideos: subSectionID } };

        const progress = await CourseProgress.findOneAndUpdate(
            { courseID, userId },
            updateOperation,
            {
                new: true,
                upsert: true,
            }
        );

        return res.status(200).json({
            success: true,
            message: "Progress Updated",
            data: progress,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "error while updating Completed Video Info.",
            error: error.message,
        });
    }
};
